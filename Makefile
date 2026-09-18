.PHONY: up down status logs build preview install

install: node_modules

node_modules: package.json
	npm install

up: install
	npx astro dev --background
	@echo "Site: http://localhost:4321/pranksters/"

down:
	npx astro dev stop

status:
	npx astro dev status

logs:
	npx astro dev logs --follow

build: install
	npm run build

preview: build
	npm run preview
