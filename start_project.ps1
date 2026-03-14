# Start Parkie Project services

Write-Host "Starting ngrok tunnel for backend on port 8000..." -ForegroundColor Red
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 8000"

Write-Host "Starting Backend API (Uvicorn)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend_api; uvicorn main:app --reload --port 8000"

Write-Host "Starting Frontend (Expo)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd Frontend/Parkie; npx expo start --tunnel"

Write-Host "All services are starting in separate windows." -ForegroundColor Green
