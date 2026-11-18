[CmdletBinding(DefaultParameterSetName = 'Prototype')]
param(
    [Parameter(Mandatory)][string]$PackagedApp,
    [Parameter(Mandatory)][string]$OutputDirectory,
    [string]$MakeAppx,
    [Parameter(Mandatory, ParameterSetName = 'Store')][string]$StoreIdentity,
    [Parameter(Mandatory, ParameterSetName = 'Store')][version]$StorePackageVersion
)

$ErrorActionPreference = 'Stop'
$appDirectory = (Resolve-Path -LiteralPath $PackagedApp).Path
$executable = Get-Item -LiteralPath (Join-Path $appDirectory 'Z2M-Automations.exe')
$version = [version]$executable.VersionInfo.ProductVersion
if ($version.Build -lt 0 -or $version.Revision -ge 0) {
    throw 'Expected the three-component application version on the packaged executable.'
}
if (-not (Test-Path -LiteralPath (Join-Path $appDirectory 'resources/app.asar') -PathType Leaf)) {
    throw 'Use the unpacked Windows x64 application from Electron Forge or the NSIS payload.'
}

$identityName = 'Burki24.Z2MAutomationsPrototype'
$publisher = 'CN=Z2M-Automations Local Prototype, OID.2.25.311729368913984317654407730594956997722=1'
$publisherDisplayName = 'Burkhard Kneiseler'
$displayName = 'Z2M-Automations (MSIX Prototype)'
$packageVersion = [version]"${version}.0"
$packageLabel = 'Prototype'
if ($PSCmdlet.ParameterSetName -eq 'Store') {
    $identity = Get-Content -LiteralPath $StoreIdentity -Raw | ConvertFrom-Json
    $identityName = $identity.name
    $publisher = $identity.publisher
    $publisherDisplayName = $identity.publisherDisplayName
    $displayName = $identity.displayName
    foreach ($value in $identityName, $publisher, $publisherDisplayName, $displayName) {
        if ($value -isnot [string] -or [string]::IsNullOrWhiteSpace($value) -or $value -cne $value.Trim()) {
            throw 'Store identity requires name, publisher, publisherDisplayName, and displayName from Partner Center.'
        }
    }
    if ($identityName -notmatch '^[A-Za-z0-9.-]{3,50}$' -or
        $identityName -eq 'Burki24.Z2MAutomationsPrototype' -or
        $publisher -match '2\.25\.311729368913984317654407730594956997722') {
        throw 'Use the assigned Store package name and publisher, without the local unsigned-package identity.'
    }
    if ($StorePackageVersion.Major -lt 1 -or $StorePackageVersion.Revision -ne 0 -or
        ($StorePackageVersion.Major, $StorePackageVersion.Minor, $StorePackageVersion.Build -gt 65535)) {
        throw 'Store package version must have four parts, a nonzero major, a zero fourth part, and all parts within 0–65535.'
    }
    $packageVersion = $StorePackageVersion
    $packageLabel = "Store-${packageVersion}"
}

if (-not $MakeAppx) {
    $sdk = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits/10/bin'
    $MakeAppx = Get-ChildItem -LiteralPath $sdk -Directory |
        Where-Object Name -Match '^\d+\.\d+\.\d+\.\d+$' |
        Sort-Object { [version]$_.Name } -Descending |
        ForEach-Object { Join-Path $_.FullName 'x64/makeappx.exe' } |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1
}
if (-not $MakeAppx) {
    throw 'Windows SDK MakeAppx.exe was not found. Supply its path using -MakeAppx.'
}

$output = (New-Item -ItemType Directory -Path $OutputDirectory -Force).FullName
$artifact = Join-Path $output "Z2M-Automations-${version}-Windows-x64-${packageLabel}.msix"
$stage = Join-Path ([IO.Path]::GetTempPath()) ('z2ma-msix-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
try {
    Get-ChildItem -LiteralPath $appDirectory -Force | Copy-Item -Destination $stage -Recurse -Force
    $assets = New-Item -ItemType Directory -Path (Join-Path $stage 'MsixAssets')
    Add-Type -AssemblyName System.Drawing
    $logo = [Drawing.Image]::FromFile((Join-Path $PSScriptRoot '../apps/desktop/renderer/app-icon.png'))
    try {
        foreach ($size in 44, 50, 150) {
            $bitmap = [Drawing.Bitmap]::new($logo, $size, $size)
            try {
                $bitmap.Save((Join-Path $assets.FullName "Logo$size.png"), [Drawing.Imaging.ImageFormat]::Png)
            } finally {
                $bitmap.Dispose()
            }
        }
    } finally {
        $logo.Dispose()
    }

    # Store builds use Partner Center's identity. Only local prototypes use the unsigned-package OID.
    $manifestPublisher = [Security.SecurityElement]::Escape($publisher)
    $manifestPublisherDisplayName = [Security.SecurityElement]::Escape($publisherDisplayName)
    $manifestDisplayName = [Security.SecurityElement]::Escape($displayName)
    $manifest = @"
<?xml version="1.0" encoding="utf-8"?>
<Package xmlns="http://schemas.microsoft.com/appx/manifest/foundation/windows10"
         xmlns:uap="http://schemas.microsoft.com/appx/manifest/uap/windows10"
         xmlns:rescap="http://schemas.microsoft.com/appx/manifest/foundation/windows10/restrictedcapabilities"
         IgnorableNamespaces="uap rescap">
  <Identity Name="$identityName" Publisher="$manifestPublisher"
            Version="$packageVersion" ProcessorArchitecture="x64" />
  <Properties>
    <DisplayName>$manifestDisplayName</DisplayName>
    <PublisherDisplayName>$manifestPublisherDisplayName</PublisherDisplayName>
    <Logo>MsixAssets\Logo50.png</Logo>
  </Properties>
  <Dependencies>
    <TargetDeviceFamily Name="Windows.Desktop" MinVersion="10.0.22000.0" MaxVersionTested="10.0.26100.0" />
  </Dependencies>
  <Resources>
    <Resource Language="en-us" />
    <Resource Language="de-de" />
  </Resources>
  <Applications>
    <Application Id="Desktop" Executable="Z2M-Automations.exe" EntryPoint="Windows.FullTrustApplication">
      <uap:VisualElements DisplayName="$manifestDisplayName"
                          Description="Zigbee2MQTT automation designer"
                          Square44x44Logo="MsixAssets\Logo44.png" Square150x150Logo="MsixAssets\Logo150.png"
                          BackgroundColor="transparent" />
    </Application>
  </Applications>
  <Capabilities>
    <rescap:Capability Name="runFullTrust" />
  </Capabilities>
</Package>
"@
    [IO.File]::WriteAllText((Join-Path $stage 'AppxManifest.xml'), $manifest)
    & $MakeAppx pack /d $stage /p $artifact /o
    if ($LASTEXITCODE -ne 0) {
        throw "MakeAppx packaging failed (exit $LASTEXITCODE)."
    }
    Get-FileHash -LiteralPath $artifact -Algorithm SHA256
} finally {
    $resolvedStage = (Resolve-Path -LiteralPath $stage).Path
    $tempParent = (Resolve-Path -LiteralPath ([IO.Path]::GetTempPath())).Path.TrimEnd('\', '/')
    if ((Split-Path -Parent $resolvedStage) -eq $tempParent -and (Split-Path -Leaf $resolvedStage) -match '^z2ma-msix-[a-f0-9]{32}$') {
        Remove-Item -LiteralPath $resolvedStage -Recurse -Force
    }
}
