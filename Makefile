.PHONY: all setup run clear

run:
	python server.py

all: setup run

setup:
	mkdir -p database/blobs-v3
	python setup-database.py

clear:
	rm -rf database
