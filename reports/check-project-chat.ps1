$qa = Invoke-RestMethod 'http://localhost:3000/api/projects/cmvbczj7b0003ikuy33svvbcx'
$original = Invoke-RestMethod 'http://localhost:3000/api/projects/cmvbaqvsf0001ikuyit2qb9wu'
$state = $qa.sketchesData
$baseline = $original.sketchesData
if ($state -is [string]) { $state=$state|ConvertFrom-Json }
if ($baseline -is [string]) { $baseline=$baseline|ConvertFrom-Json }
@{screenCount=$state.shapes.ids.Count;originalIdsPreserved=(@('inspector-mobile','inspector-tablet')|Where-Object{$_ -notin $state.shapes.ids}).Count -eq 0;tabletSourceUnchanged=$state.shapes.entities.'inspector-tablet'.uiSpecData -ceq $baseline.shapes.entities.'inspector-tablet'.uiSpecData;mobileButtonBlue=$state.shapes.entities.'inspector-mobile'.uiSpecData.Contains('background-color: #2563eb');historyCount=$state.projectMessages.Count} | ConvertTo-Json | Set-Content reports/project-chat-live-checks.json
$state | ConvertTo-Json -Depth 40 | Set-Content reports/project-chat-before-redesign.json
Get-Content reports/project-chat-live-checks.json
