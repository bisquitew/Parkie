.PHONY: backend vision mobile dashboard test

backend:
	cd backend_api && uvicorn app.main:app --reload

vision:
	cd ai_vision && python vision_agent.py

mobile:
	cd Frontend/Parkie && npx expo start

dashboard:
	cd Frontend/Dashboard && npm run dev

test:
	cd backend_api && pytest
	cd Frontend/Dashboard && npm test
