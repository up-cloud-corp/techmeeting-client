# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/engine/reference/builder/

ARG NODE_VERSION=20.15.0

FROM node:${NODE_VERSION}

# Use production node environment by default.
ENV NODE_ENV development

# RUN apk update && \
#   apk add git

WORKDIR /usr/src/app

# Copy the rest of the source files into the image.
COPY . .

# RUN yarn config set script-shell /bin/sh

# RUN cd libs/lib-jitsi-meet && \
#     yarn && \
#     yarn link && \
#     cd ../.. && \
#     yarn link lib-jitsi-meet

# Download dependencies as a separate step to take advantage of Docker's caching.
# Leverage a cache mount to /root/.yarn to speed up subsequent builds.
# Leverage a bind mounts to package.json and yarn.lock to avoid having to copy them into
# into this layer.
# RUN --mount=type=bind,source=package.json,target=package.json \
#     --mount=type=bind,source=yarn.lock,target=yarn.lock \
#     --mount=type=cache,target=/root/.yarn \
#     yarn install
RUN yarn install

# Run the application as a non-root user.
USER node


# Expose the port that the application listens on.
EXPOSE 3000


# Run the application.
CMD yarn start
