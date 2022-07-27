# playdate-itchio-sync-server

Keep your Playdate sideload games synced with your itch.io playdate game library.

The goal of this repo is to make playdate-itchio-sync a Express NodeJS app.

## Current Features
- Login / Disconnect from PlayDate account
- Get sideloaded games

## Requirements
- node.js 16+
- MySQL

## Notes
- Will not work with accounts that use two-factor authentication on itch.io.
- You *must* set a password for your itch.io account, oAuth is not supported.
- Only works with games you have __paid for__ currently.
- You will probably want to run this every once in a while, it's not a background process.
- Use at your own risk!


- Some features are still in dev, for now, any update can break your installation (Like DB, Endpoints...)
- Not all features from original repo are implemented (In dev)

## License
MIT, copyright 2022 Eric Lewis.
