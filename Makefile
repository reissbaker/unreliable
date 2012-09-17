clean:
	@rm -rf build/

build-js:
	@rm -rf build
	@mkdir build
	@uglifyjs -o ./build/unreliable.min.js ./unreliable.js
	@gzip -c ./build/unreliable.min.js > ./build/unreliable.min.js.gz

build-test:
	@./node_modules/.bin/coffee -cb test/

build: clean build-js build-test

run-test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter dot \
		--slow 600 \
		test/*.js

test: build-test run-test

.PHONY: build test
