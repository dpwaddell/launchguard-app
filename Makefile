.PHONY: build up down logs migrate shell

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=100 app

migrate:
	docker compose exec app npx prisma migrate deploy

shell:
	docker compose exec app sh

ps:
	docker compose ps
