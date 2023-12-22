#!/bin/sh -ex

cd $(dirname $0)

mkdir -p npmjs/gen/
cp openFPGALoader-build/openFPGALoader.* npmjs/gen/

cd npmjs
node prepare.mjs
npm install
npm run build

mkdir -p dist/
npm pack --pack-destination=dist/
