# BUILD PHASE
FROM oven/bun:1.0.2 AS build
ENV TZ Europe/Rome
WORKDIR /app
COPY . ./
RUN bun install
RUN bun build-cron

# FINAL CONTAINER
FROM ubuntu:26.04
ENV TZ Europe/Rome
WORKDIR /app
COPY .config/gym-analysis /root/.config/gym-analysis
COPY --from=build /app/dist/out /app/dist/out
ENTRYPOINT ["./dist/out"]