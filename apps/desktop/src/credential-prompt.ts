import {execFile} from 'node:child_process';
import {join} from 'node:path';
import {parseCredentials} from './credentials.js';

const windowsForm = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$form = New-Object Windows.Forms.Form
$form.Text = $env:Z2MA_PROMPT_TITLE
$form.AutoSize = $true
$form.AutoSizeMode = 'GrowAndShrink'
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$fields = New-Object Windows.Forms.FlowLayoutPanel
$fields.FlowDirection = 'TopDown'
$fields.WrapContents = $false
$fields.Padding = [Windows.Forms.Padding]::new(12)
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
    $button.DialogResult = $name
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
    if ($form.ShowDialog() -ne 'OK') { exit 2 }
    @{username = $user.Text; password = $password.Text} | ConvertTo-Json -Compress
} finally { $form.Dispose() }
`;

export function promptCredentials(labels: {title: string; username: string; password: string; ok: string; cancel: string}): Promise<ReturnType<typeof parseCredentials> | null> {
  const windows = process.platform === 'win32';
  const separator = '\u001f';
  const command = windows ? join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe') : '/usr/bin/zenity';
  const args = windows ? ['-NoLogo', '-NoProfile', '-STA', '-EncodedCommand', Buffer.from(windowsForm, 'utf16le').toString('base64')]
    : ['--forms', '--title=' + labels.title, '--text=' + labels.title, '--add-entry=' + labels.username,
      '--add-password=' + labels.password, '--separator=' + separator, '--ok-label=' + labels.ok, '--cancel-label=' + labels.cancel];
  const env = {...process.env, Z2MA_PROMPT_TITLE: labels.title, Z2MA_PROMPT_USER: labels.username,
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
