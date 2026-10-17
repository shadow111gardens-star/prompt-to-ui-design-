$source = Invoke-RestMethod 'http://localhost:3000/api/projects/cmvbaqvsf0001ikuyit2qb9wu'
$sketch = $source.sketchesData
if ($sketch -is [string]) { $sketch = $sketch | ConvertFrom-Json }
$sketch.PSObject.Properties.Remove('activeProjectId')
$sketch.PSObject.Properties.Remove('projectMessages')
$sketch.shapes.ids = @('inspector-mobile','inspector-tablet')
$sketch.shapes.entities.PSObject.Properties.Remove('inspector-desktop')
$sketch.selected = @{}
$body = @{name='Project Chat QA'; sketchesData=$sketch} | ConvertTo-Json -Depth 40
$qa = Invoke-RestMethod 'http://localhost:3000/api/projects' -Method Post -ContentType 'application/json' -Body $body
$qa | ConvertTo-Json | Set-Content reports/project-chat-qa.json
$qa | ConvertTo-Json
