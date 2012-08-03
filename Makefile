build:
	@rm -rf build
	@mkdir build
	@uglifyjs -o ./build/unreliable.min.js ./unreliable.js
	@gzip -c ./build/unreliable.min.js > ./build/unreliable.min.js.gz

.PHONY: build
