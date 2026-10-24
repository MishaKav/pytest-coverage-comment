# OSS Scanner image (https://github.com/anthropics/oss-scanner). Node 24 matches .nvmrc and action.yml (node24).
FROM node:24.22.1-bookworm

# scanner contract: the checkout lives inside the image, at /src
COPY . /src
WORKDIR /src

RUN npm ci
RUN npm run build
# fails the image build on a failing test; the suite is fully offline (vitest + fixtures in data/)
RUN npm test
