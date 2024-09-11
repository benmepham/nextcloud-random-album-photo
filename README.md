# Nextcloud Random Photo from Album

NodeJS (Express) API to get a random photo from a Nextcloud album. For example for using with [lovelace-wallpanel](https://github.com/j-a-n/lovelace-wallpanel).

Would not have been possible without [dav-slideshow](https://github.com/Half-Shot/dav-slideshow)

## Setup

- populate `.env` based on `.env.sample`
- `npm i`
- `npm run start`

## Docker

Sample docker-compose

```
    nextcloud-random-album-photo:
        container_name: nextcloud-random-album-photo
        restart: unless-stopped
        security_opt:
            - no-new-privileges:true
        image: ghcr.io/benmepham/nextcloud-random-album-photo:latest
        env_file:
            - .env
        depends_on:
            - nextcloud
        ports:
            - 3000:3000
```
