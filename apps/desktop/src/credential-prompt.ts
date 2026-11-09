import {execFile} from 'node:child_process';
import {join} from 'node:path';
import {parseCredentials} from './credentials.js';

const windowsForm = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Windows.Forms;

public sealed class CredentialPromptOwner : IWin32Window {
    public CredentialPromptOwner(IntPtr handle) { Handle = handle; }
    public IntPtr Handle { get; private set; }
}
'@
$owner = [CredentialPromptOwner]::new([IntPtr]::new([long]$env:Z2MA_PROMPT_OWNER))
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$form = New-Object Windows.Forms.Form
$form.Text = $env:Z2MA_PROMPT_TITLE
$form.AutoSize = $true
$form.AutoSizeMode = 'GrowAndShrink'
$form.StartPosition = 'CenterParent'
$form.ShowInTaskbar = $false
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.Font = [Drawing.Font]::new('Segoe UI', 11)
$form.AutoScaleMode = 'Font'
# Match the shared designer palette while honoring Windows high contrast.
$themed = -not [Windows.Forms.SystemInformation]::HighContrast
if ($themed) {
    $colors = if ($env:Z2MA_PROMPT_DARK -eq '1') {
        @('#192431', '#eff6fc', '#101822', '#344657', '#55dec0', '#092b24')
    } else {
        @('#ffffff', '#152b3e', '#f5f8fb', '#d6e1e9', '#00796f', '#ffffff')
    }
    $surface, $ink, $field, $line, $primary, $onPrimary = $colors | ForEach-Object { [Drawing.ColorTranslator]::FromHtml($_) }
    $form.BackColor = $surface
    $form.ForeColor = $ink
}
$fields = New-Object Windows.Forms.FlowLayoutPanel
$fields.FlowDirection = 'TopDown'
$fields.WrapContents = $false
$fields.Padding = [Windows.Forms.Padding]::new(18)
$fields.AutoSize = $true
$form.Controls.Add($fields)
function Add-Field($caption, $limit, $secret) {
    $label = New-Object Windows.Forms.Label
    $label.Text = $caption
    $label.AutoSize = $true
    $fields.Controls.Add($label)
    $inputField = New-Object Windows.Forms.TextBox
    $inputField.Width = 320
    $inputField.MaxLength = $limit
    $inputField.UseSystemPasswordChar = $secret
    $inputField.Margin = [Windows.Forms.Padding]::new(3, 4, 3, 12)
    if ($themed) {
        $inputField.BackColor = $field
        $inputField.ForeColor = $ink
    }
    $fields.Controls.Add($inputField)
    return $inputField
}
$user = Add-Field $env:Z2MA_PROMPT_USER 256 $false
$password = Add-Field $env:Z2MA_PROMPT_PASSWORD 4096 $true
$buttons = New-Object Windows.Forms.FlowLayoutPanel
$buttons.AutoSize = $true
$fields.Controls.Add($buttons)
foreach ($name in 'OK', 'Cancel') {
    $button = New-Object Windows.Forms.Button
    $button.AutoSize = $true
    $button.Padding = [Windows.Forms.Padding]::new(10, 4, 10, 4)
    $button.DialogResult = $name
    if ($themed) {
        $button.FlatStyle = 'Flat'
        $button.FlatAppearance.BorderColor = $line
        $button.BackColor = $field
        $button.ForeColor = $ink
        if ($name -eq 'OK') {
            $button.BackColor = $primary
            $button.ForeColor = $onPrimary
        }
    }
    if ($name -eq 'OK') {
        $button.Text = $env:Z2MA_PROMPT_OK
        $form.AcceptButton = $button
    } else {
        $button.Text = $env:Z2MA_PROMPT_CANCEL
        $form.CancelButton = $button
    }
    $buttons.Controls.Add($button)
}
try {
    $form.Add_Shown({
        $form.Activate()
        [void]$user.Focus()
    })
    if ($form.ShowDialog($owner) -ne 'OK') { exit 2 }
    @{username = $user.Text; password = $password.Text} | ConvertTo-Json -Compress
} finally { $form.Dispose() }
`;

export function promptCredentials(labels: {title: string; username: string; password: string; ok: string; cancel: string}, ownerHandle: Buffer, dark: boolean): Promise<ReturnType<typeof parseCredentials> | null> {
  const windows = process.platform === 'win32';
  const separator = '\u001f';
  const command = windows ? join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe') : '/usr/bin/zenity';
  const args = windows ? ['-NoLogo', '-NoProfile', '-STA', '-EncodedCommand', Buffer.from(windowsForm, 'utf16le').toString('base64')]
    : ['--forms', '--title=' + labels.title, '--text=' + labels.title, '--add-entry=' + labels.username,
      '--add-password=' + labels.password, '--separator=' + separator, '--ok-label=' + labels.ok, '--cancel-label=' + labels.cancel];
  const owner = windows ? ownerHandle.readBigUInt64LE().toString() : '';
  const env = {...process.env, Z2MA_PROMPT_OWNER: owner, Z2MA_PROMPT_DARK: dark ? '1' : '0', Z2MA_PROMPT_TITLE: labels.title, Z2MA_PROMPT_USER: labels.username,
    Z2MA_PROMPT_PASSWORD: labels.password, Z2MA_PROMPT_OK: labels.ok, Z2MA_PROMPT_CANCEL: labels.cancel};
  return new Promise((resolve, reject) => {
    execFile(command, args, {env, windowsHide: true, encoding: 'utf8', maxBuffer: 65536, timeout: 300000}, (error, output) => {
      if (error) {
        if (error.code === 1 && !windows) { resolve(null); return; }
        if (error.code === 2 && windows) { resolve(null); return; }
        reject(new Error('credentialPromptUnavailable')); return;
      }
      try {
        if (windows) { resolve(parseCredentials(JSON.parse(output))); return; }
        const fields = output.replace(/\r?\n$/, '').split(separator);
        if (fields.length !== 2) throw new Error();
        resolve(parseCredentials({username: fields[0], password: fields[1]}));
      } catch { reject(new Error('invalidCredentials')); }
    });
  });
}
