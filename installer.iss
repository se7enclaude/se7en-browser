; se7en Browser — installeur Windows (Inno Setup 6), construit par tools/build.js.
;
;   ISCC /DAppVersion=1.0.0 /DStage=<dist\build> installer.iss   ->  se7en-Browser-Setup-1.0.0.exe
;
; Pour l'utilisateur courant (pas de droits administrateur) : %LOCALAPPDATA%\Programs\se7en Browser, raccourcis Bureau
; et menu Démarrer. Le même .exe sert de mise à jour (Seventh OS le lance en silencieux ; /RELAUNCH=1 rouvre le navigateur).
; Données gardées à la désinstallation : %APPDATA%\se7en Browser (réglages, onglets, coffre, historique, profil social).
; Ollama et ses modèles, s'ils ont été installés depuis le navigateur, ont leur propre désinstallation.

#ifndef AppVersion
  #define AppVersion "1.0.0"
#endif
#ifndef Stage
  #define Stage "dist\build"
#endif
#define AppName "se7en Browser"
#define AppExe "se7en Browser.exe"

[Setup]
AppId={{1A9955C2-B244-4539-87BD-0046C5A2DD9E}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher=se7en
VersionInfoVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
DisableDirPage=yes
PrivilegesRequired=lowest
OutputBaseFilename=se7en-Browser-Setup-{#AppVersion}
SetupIconFile=build\icon.ico
UninstallDisplayIcon={app}\resources\app\build\icon.ico
UninstallDisplayName={#AppName}
WizardStyle=modern
WizardImageFile=build\wizard-large.bmp
WizardSmallImageFile=build\wizard-small.bmp
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
CloseApplications=yes
RestartApplications=no
Compression=lzma2/max
SolidCompression=yes

[Languages]
Name: "fr"; MessagesFile: "compiler:Languages\French.isl"

[CustomMessages]
fr.Launch=Ouvrir se7en Browser

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[InstallDelete]
; le navigateur est remplacé en entier (pas de vieux fichiers après une mise à jour)
Type: filesandordirs; Name: "{app}\resources\app"

[Files]
Source: "{#Stage}\app\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"; IconFilename: "{app}\resources\app\build\icon.ico"; AppUserModelID: "se7en.browser"
Name: "{group}\{cm:UninstallProgram,{#AppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; IconFilename: "{app}\resources\app\build\icon.ico"; Tasks: desktopicon

[Registry]
; Déclare se7en Browser à Windows comme navigateur possible (liens http/https et PDF). Il n'est PAS mis par défaut :
; c'est l'utilisateur qui le choisit dans Paramètres › Applications par défaut (bouton dans le navigateur).
Root: HKCU; Subkey: "Software\Classes\se7enBrowserHTML"; ValueType: string; ValueName: ""; ValueData: "Page web se7en Browser"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\se7enBrowserHTML\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExe},0"
Root: HKCU; Subkey: "Software\Classes\se7enBrowserHTML\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExe}"" ""%1"""
Root: HKCU; Subkey: "Software\Classes\se7enBrowserPDF"; ValueType: string; ValueName: ""; ValueData: "Document PDF (se7en Browser)"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\se7enBrowserPDF\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExe},0"
Root: HKCU; Subkey: "Software\Classes\se7enBrowserPDF\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExe}"" ""%1"""
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\{#AppName}"; ValueType: string; ValueName: ""; ValueData: "{#AppName}"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\{#AppName}\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: "{app}\{#AppExe},0"
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\{#AppName}\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\{#AppExe}"""
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\{#AppName}\Capabilities"; ValueType: string; ValueName: "ApplicationName"; ValueData: "{#AppName}"
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\{#AppName}\Capabilities"; ValueType: string; ValueName: "ApplicationDescription"; ValueData: "Navigateur Liquid Glass avec IA locale"
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\{#AppName}\Capabilities"; ValueType: string; ValueName: "ApplicationIcon"; ValueData: "{app}\{#AppExe},0"
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\{#AppName}\Capabilities\URLAssociations"; ValueType: string; ValueName: "http"; ValueData: "se7enBrowserHTML"
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\{#AppName}\Capabilities\URLAssociations"; ValueType: string; ValueName: "https"; ValueData: "se7enBrowserHTML"
Root: HKCU; Subkey: "Software\Clients\StartMenuInternet\{#AppName}\Capabilities\FileAssociations"; ValueType: string; ValueName: ".pdf"; ValueData: "se7enBrowserPDF"
Root: HKCU; Subkey: "Software\RegisteredApplications"; ValueType: string; ValueName: "{#AppName}"; ValueData: "Software\Clients\StartMenuInternet\{#AppName}\Capabilities"; Flags: uninsdeletevalue

[Run]
Filename: "{app}\{#AppExe}"; Description: "{cm:Launch}"; Flags: nowait postinstall skipifsilent
Filename: "{app}\{#AppExe}"; Flags: nowait; Check: ShouldRelaunch

[UninstallDelete]
Type: filesandordirs; Name: "{app}"

[Code]
function ShouldRelaunch(): Boolean;
begin
  Result := ExpandConstant('{param:RELAUNCH|0}') = '1';
end;
