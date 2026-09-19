# Drifter

Project scaffold for tracking interests, timelines, drift, and discovery.

## Google history import

Drifter can request YouTube activity through the Google Data Portability API.
This uses the restricted `dataportability.myactivity.youtube` scope in a
separate OAuth flow from ordinary YouTube access. Production use requires the
additional Google verification and security requirements for restricted data,
unless the app qualifies for a documented development or testing exception.

Google creates the archive asynchronously. It may take minutes, hours, or
potentially days; Drifter stores the export job and polls its status, then
imports the completed archive into the existing embeddings, clustering, and
topic pipeline automatically.

See the [Google Data Portability API documentation](https://developers.google.com/data-portability/user-guide/introduction)
for approval, supported-region, consent, and retention requirements.
