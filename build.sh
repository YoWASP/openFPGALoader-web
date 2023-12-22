#!/bin/sh -ex

export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct)

cd $(dirname $0)

EMSDK_VERSION="3.1.51"
./emsdk/emsdk install ${EMSDK_VERSION}
./emsdk/emsdk activate ${EMSDK_VERSION}
export PATH=$(pwd)/emsdk:$(pwd)/emsdk/upstream/emscripten:${PATH}
export PKG_CONFIG_PATH=$(pwd)/prefix/lib/pkgconfig

emcmake cmake -S zlib-src -B zlib-build \
    -DCMAKE_C_COMPILER_LAUNCHER=ccache \
    -DCMAKE_BUILD_TYPE=MinSizeRel \
    -DCMAKE_INSTALL_PREFIX=$(pwd)/prefix \
    -DINSTALL_PKGCONFIG_DIR=$(pwd)/prefix/lib/pkgconfig \
    -DCMAKE_C_FLAGS="-pthread -fexceptions"
emmake make -C zlib-build install VERBOSE=1

[ -e ./libusb-src/configure ] || (
    cd ./libusb-src &&
    ./bootstrap.sh)
[ -e ./libusb-build/Makefile ] || (
    mkdir -p libusb-build &&
    cd ./libusb-build &&
    CFLAGS="-Os -pthread -fexceptions" \
    emconfigure ../libusb-src/configure \
        --host=wasm32-emscripten \
        --prefix=$(realpath $(pwd)/../prefix))
emmake make -C libusb-build install

emcmake cmake -S libftdi-src -B libftdi-build \
    -DCMAKE_C_COMPILER_LAUNCHER=ccache \
    -DCMAKE_BUILD_TYPE=MinSizeRel \
    -DCMAKE_INSTALL_PREFIX="$(pwd)/prefix" \
    -DCMAKE_INSTALL_LIBDIR="$(pwd)/prefix/lib" \
    -DLIBUSB_INCLUDE_DIR="$(pwd)/prefix/include/libusb-1.0" \
    -DLIBUSB_LIBRARIES="-L$(pwd)/prefix/lib -lusb-1.0" \
    -DCMAKE_C_FLAGS="-pthread -fexceptions" \
    -DFTDI_EEPROM=OFF \
    -DEXAMPLES=OFF
emmake make -C libftdi-build install VERBOSE=1

emcmake cmake -S hidapi-src -B hidapi-build \
    -DCMAKE_C_COMPILER_LAUNCHER=ccache \
    -DCMAKE_BUILD_TYPE=MinSizeRel \
    -DCMAKE_INSTALL_PREFIX="$(pwd)/prefix" \
    -DCMAKE_INSTALL_LIBDIR="$(pwd)/prefix/lib" \
    -DCMAKE_C_FLAGS="-pthread -fexceptions"
emmake make -C hidapi-build install VERBOSE=1

# INITIAL_MEMORY is set to 32MB instead of using ALLOW_MEMORY_GROWTH since the latter is currently
# slow when combined with -pthread.
# --pre-js is specified due to a bug in PIPEFS where assert() is used without defining it.
EMCC_FLAGS=" \
-s STRICT=1 \
-s ENVIRONMENT=worker \
-s ASYNCIFY=1 \
-s INVOKE_RUN=0 \
-s EXIT_RUNTIME=1 \
-s MALLOC=emmalloc \
-s INITIAL_MEMORY=33554432 \
-s EXPORTED_RUNTIME_METHODS=FS,stackAlloc,stringToUTF8OnStack,ccall \
-s EXPORTED_FUNCTIONS=_main,_fflush \
-s MODULARIZE=1 \
-s EXPORT_NAME=instantiate \
-s EXPORT_ES6=1 \
-s USE_ES6_IMPORT_META=1 \
-s WASM_BIGINT=1 \
-s TEXTDECODER=1 \
-s DISABLE_EXCEPTION_CATCHING=0 \
--pre-js $(pwd)/assert.js"
emcmake cmake -S openFPGALoader-src -B openFPGALoader-build \
    -DCMAKE_CXX_COMPILER_LAUNCHER=ccache \
    -DCMAKE_BUILD_TYPE=MinSizeRel \
    -DCMAKE_INSTALL_PREFIX="$(pwd)/prefix" \
    -DCMAKE_CXX_FLAGS="-pthread -fexceptions" \
    -DCMAKE_EXE_LINKER_FLAGS="-lembind ${EMCC_FLAGS}" \
    -DCMAKE_EXECUTABLE_SUFFIX_CXX=".mjs"
emmake make -C openFPGALoader-build VERBOSE=1
