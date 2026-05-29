.PHONY: backend vision mobile dashboard test

VENV = $(CURDIR)/.venv
PYTHON = $(VENV)/bin/python
UVICORN = $(VENV)/bin/uvicorn
PYTEST = $(VENV)/bin/pytest

backend:
	cd backend_api && $(UVICORN) app.main:app --reload

vision:
	cd ai_vision && $(PYTHON) vision_agent.py

mobile:
	cd Frontend/Parkie && npx expo start

dashboard:
	cd Frontend/Dashboard && npm run dev

test:
	cd backend_api && $(PYTEST)
	cd Frontend/Dashboard && npm run test
