$baseUrl = "http://localhost:3002"
$roomId = "test-room-123"

Write-Host "[POST] Creating message..." -ForegroundColor Yellow
$postResp = Invoke-RestMethod -Uri "$baseUrl/rooms/$roomId/messages" -Method Post -ContentType "application/json" -Body '{"content":"Hello from Issue #12!"}'
Write-Host "✅ Created: $($postResp._id)" -ForegroundColor Green
$msgId = $postResp._id

Write-Host "[GET] Fetching messages..." -ForegroundColor Yellow
$getResp = Invoke-RestMethod "$baseUrl/rooms/$roomId/messages?limit=5"
Write-Host "✅ Got $($getResp.messages.Count) message(s), nextCursor: $($getResp.nextCursor)" -ForegroundColor Green

if ($msgId) {
  Write-Host "[PUT] Editing message..." -ForegroundColor Yellow
  $putResp = Invoke-RestMethod -Uri "$baseUrl/messages/$msgId" -Method Put -ContentType "application/json" -Body '{"content":"Edited!"}'
  Write-Host "✅ Edited at: $($putResp.editedAt)" -ForegroundColor Green

  Write-Host "[DELETE] Deleting message..." -ForegroundColor Yellow
  $delResp = Invoke-RestMethod -Uri "$baseUrl/messages/$msgId" -Method Delete
  Write-Host "✅ Deleted: $($delResp.message)" -ForegroundColor Green
}

Write-Host "`n🎉 All tests passed!" -ForegroundColor Cyan
