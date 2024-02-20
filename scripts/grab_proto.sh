#!/bin/bash
folder="proto"

if [ ! -d "${folder}" ]; then
    mkdir "${folder}"
fi

curl -o proto/tiktokSchema.proto https://raw.githubusercontent.com/EnderGamingFilms/TikTok-Live-Connector/main/src/proto/tiktokSchema.proto
