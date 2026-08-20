ARG grafana_version=13.0.2
ARG grafana_image=grafana-oss

FROM grafana/${grafana_image}:${grafana_version}

# Make simple to access the grafana instance for development purposes
# Do NOT enable these settings in a public facing / production grafana instance
ENV GF_AUTH_BASIC_ENABLED="true"

# Set development mode so plugins can be loaded without the need to sign
ENV GF_DEFAULT_APP_MODE="development"

# Inject livereload script into grafana index.html
# Grafana renders the tags on separate lines ("</body>", "</html>"), so the
# script is inserted right before the closing body tag.
USER root
RUN sed -i 's#</body>#<script src="http://localhost:35729/livereload.js"></script></body>#g' /usr/share/grafana/public/views/index.html
