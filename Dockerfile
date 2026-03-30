# Use Debian (glibc) for the build stage so npm ci resolves the correct
# platform-specific Rollup binary (@rollup/rollup-linux-x64-gnu) that matches
# the package-lock.json generated on a glibc system.
FROM node:20-slim AS build-env
COPY . /app/
WORKDIR /app
# Install all dependencies (including dev) directly in this stage so
# platform-specific optional binaries like @rollup/rollup-linux-x64-musl
# are resolved for the correct Alpine (musl) target.
RUN npm ci
RUN npm run build
# Copy question data alongside the compiled server bundle so GameManager can
# locate the files at runtime via __dirname (which resolves to build/server/).
RUN cp -r /app/server/data /app/build/server/data

FROM node:20-alpine AS production-dependencies-env
COPY ./package.json package-lock.json /app/
WORKDIR /app
RUN npm ci --omit=dev

FROM node:20-alpine
COPY ./package.json package-lock.json server.js /app/
COPY --from=production-dependencies-env /app/node_modules /app/node_modules
COPY --from=build-env /app/build /app/build
WORKDIR /app
CMD ["npm", "run", "start"]
