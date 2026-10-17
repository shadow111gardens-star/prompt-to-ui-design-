Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression.FileSystem
$checks=@{}
foreach($extension in @('png','jpg')) {
 $path="C:\Users\Abhay Solanki\Downloads\01-Inspector QA · Mobile.$extension"
 $img=[System.Drawing.Image]::FromFile($path)
 $checks[$extension]=@{width=$img.Width;height=$img.Height;bytes=(Get-Item -LiteralPath $path).Length;format=$img.RawFormat.ToString()}
 $img.Dispose()
}
$svg=Get-Content -LiteralPath 'C:\Users\Abhay Solanki\Downloads\01-Inspector QA · Mobile.svg' -Raw
[xml]$xml=$svg
$checks.svg=@{validXml=$null -ne $xml.DocumentElement;root=$xml.DocumentElement.LocalName;hasForeignObject=$svg.Contains('foreignObject');noScript=-not ($svg -match '<script\b');hasEditedText=$svg.Contains('Edited mobile heading')}
foreach($extension in @('png','jpg','svg')) {
 $zip=[System.IO.Compression.ZipFile]::OpenRead("C:\Users\Abhay Solanki\Downloads\openui-all-screens-$extension.zip")
 $checks["all-$extension"]=@{count=$zip.Entries.Count;files=@($zip.Entries.FullName);nonEmpty=(@($zip.Entries|Where-Object Length -le 0).Count -eq 0)}
 $zip.Dispose()
}
$checks|ConvertTo-Json -Depth 8|Set-Content reports/image-export-verification.json
Get-Content reports/image-export-verification.json
