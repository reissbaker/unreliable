build:
	@rm -rf build
	@mkdir build
	@coffee -co ./build/ unreliable.coffee
	@uglifyjs -o ./build/unreliable.min.js ./build/unreliable.js
	@gzip -c ./build/unreliable.min.js > ./build/unreliable.min.js.gz

.PHONY: build
