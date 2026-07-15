# Spotify Web API endpoints

Based on the official Spotify Web API documentation and the extensive changes announced on **November 27, 2024**, here is the complete list of endpoints.

> **⚠️ Important Note on Deprecations (Effective Nov 2024):**
> As of November 27, 2024, Spotify has **deprecated and restricted** access to several discovery and analysis endpoints for **new applications**. Applications created after this date (or those without specific "Extended Mode" approval) will receive a `403 Forbidden` error when accessing endpoints marked below as **[DEPRECATED / RESTRICTED]**.

### **Base URL:** `https://api.spotify.com/v1`

---

## Albums

### Get Album
**Method:** `GET`
**Endpoint:** `/albums/{id}`
**Description:** Get Spotify catalog information for a single album.
**Link:** [/documentation/web-api/reference/get-an-album](https://developer.spotify.com/documentation/web-api/reference/get-an-album)

### Get Several Albums
**Method:** `GET`
**Endpoint:** `/albums`
**Description:** Get Spotify catalog information for multiple albums identified by their Spotify IDs.
**Link:** [/documentation/web-api/reference/get-multiple-albums](https://developer.spotify.com/documentation/web-api/reference/get-multiple-albums)

### Get Album Tracks
**Method:** `GET`
**Endpoint:** `/albums/{id}/tracks`
**Description:** Get Spotify catalog information about an album’s tracks.
**Link:** [/documentation/web-api/reference/get-an-albums-tracks](https://developer.spotify.com/documentation/web-api/reference/get-an-albums-tracks)

### Get User's Saved Albums
**Method:** `GET`
**Endpoint:** `/me/albums`
**Description:** Get a list of the albums saved in the current Spotify user's 'Your Music' library.
**Link:** [/documentation/web-api/reference/get-users-saved-albums](https://developer.spotify.com/documentation/web-api/reference/get-users-saved-albums)

### Save Albums for Current User
**Method:** `PUT`
**Endpoint:** `/me/albums`
**Description:** Save one or more albums to the current user's 'Your Music' library.
**Link:** [/documentation/web-api/reference/save-albums-user](https://developer.spotify.com/documentation/web-api/reference/save-albums-user)

### Remove Users' Saved Albums
**Method:** `DELETE`
**Endpoint:** `/me/albums`
**Description:** Remove one or more albums from the current user's 'Your Music' library.
**Link:** [/documentation/web-api/reference/remove-albums-user](https://developer.spotify.com/documentation/web-api/reference/remove-albums-user)

### Check User's Saved Albums
**Method:** `GET`
**Endpoint:** `/me/albums/contains`
**Description:** Check if one or more albums is already saved in the current Spotify user's 'Your Music' library.
**Link:** [/documentation/web-api/reference/check-users-saved-albums](https://developer.spotify.com/documentation/web-api/reference/check-users-saved-albums)

### Get New Releases
**Method:** `GET`
**Endpoint:** `/browse/new-releases`
**Description:** Get a list of new album releases featured in Spotify.
**Link:** [/documentation/web-api/reference/get-new-releases](https://developer.spotify.com/documentation/web-api/reference/get-new-releases)

---

## Artists

### Get Artist
**Method:** `GET`
**Endpoint:** `/artists/{id}`
**Description:** Get Spotify catalog information for a single artist identified by their unique Spotify ID.
**Link:** [/documentation/web-api/reference/get-an-artist](https://developer.spotify.com/documentation/web-api/reference/get-an-artist)

### Get Several Artists
**Method:** `GET`
**Endpoint:** `/artists`
**Description:** Get Spotify catalog information for several artists based on their Spotify IDs.
**Link:** [/documentation/web-api/reference/get-multiple-artists](https://developer.spotify.com/documentation/web-api/reference/get-multiple-artists)

### Get Artist's Albums
**Method:** `GET`
**Endpoint:** `/artists/{id}/albums`
**Description:** Get Spotify catalog information about an artist's albums.
**Link:** [/documentation/web-api/reference/get-an-artists-albums](https://developer.spotify.com/documentation/web-api/reference/get-an-artists-albums)

### Get Artist's Top Tracks
**Method:** `GET`
**Endpoint:** `/artists/{id}/top-tracks`
**Description:** Get Spotify catalog information about an artist's top tracks by country.
**Link:** [/documentation/web-api/reference/get-an-artists-top-tracks](https://developer.spotify.com/documentation/web-api/reference/get-an-artists-top-tracks)

### Get Artist's Related Artists **[DEPRECATED / RESTRICTED]**
**Method:** `GET`
**Endpoint:** `/artists/{id}/related-artists`
**Description:** Get Spotify catalog information about artists similar to a given artist.
**Link:** [/documentation/web-api/reference/get-an-artists-related-artists](https://developer.spotify.com/documentation/web-api/reference/get-an-artists-related-artists)

---

## Audiobooks

### Get an Audiobook
**Method:** `GET`
**Endpoint:** `/audiobooks/{id}`
**Description:** Get Spotify catalog information for a single audiobook.
**Link:** [/documentation/web-api/reference/get-an-audiobook](https://developer.spotify.com/documentation/web-api/reference/get-an-audiobook)

### Get Several Audiobooks
**Method:** `GET`
**Endpoint:** `/audiobooks`
**Description:** Get Spotify catalog information for several audiobooks identified by their Spotify IDs.
**Link:** [/documentation/web-api/reference/get-multiple-audiobooks](https://developer.spotify.com/documentation/web-api/reference/get-multiple-audiobooks)

### Get Audiobook Chapters
**Method:** `GET`
**Endpoint:** `/audiobooks/{id}/chapters`
**Description:** Get Spotify catalog information about an audiobook's chapters.
**Link:** [/documentation/web-api/reference/get-audiobook-chapters](https://developer.spotify.com/documentation/web-api/reference/get-audiobook-chapters)

### Get User's Saved Audiobooks
**Method:** `GET`
**Endpoint:** `/me/audiobooks`
**Description:** Get a list of the audiobooks saved in the current Spotify user's 'Your Music' library.
**Link:** [/documentation/web-api/reference/get-users-saved-audiobooks](https://developer.spotify.com/documentation/web-api/reference/get-users-saved-audiobooks)

### Save Audiobooks for Current User
**Method:** `PUT`
**Endpoint:** `/me/audiobooks`
**Description:** Save one or more audiobooks to the current user's 'Your Music' library.
**Link:** [/documentation/web-api/reference/save-audiobooks-user](https://developer.spotify.com/documentation/web-api/reference/save-audiobooks-user)

### Remove User's Saved Audiobooks
**Method:** `DELETE`
**Endpoint:** `/me/audiobooks`
**Description:** Remove one or more audiobooks from the current user's 'Your Music' library.
**Link:** [/documentation/web-api/reference/remove-audiobooks-user](https://developer.spotify.com/documentation/web-api/reference/remove-audiobooks-user)

### Check User's Saved Audiobooks
**Method:** `GET`
**Endpoint:** `/me/audiobooks/contains`
**Description:** Check if one or more audiobooks are already saved in the current Spotify user's 'Your Music' library.
**Link:** [/documentation/web-api/reference/check-users-saved-audiobooks](https://developer.spotify.com/documentation/web-api/reference/check-users-saved-audiobooks)

---

## Categories

### Get Several Browse Categories
**Method:** `GET`
**Endpoint:** `/browse/categories`
**Description:** Get a list of categories used to tag items in Spotify.
**Link:** [/documentation/web-api/reference/get-categories](https://developer.spotify.com/documentation/web-api/reference/get-categories)

### Get Single Browse Category
**Method:** `GET`
**Endpoint:** `/browse/categories/{category_id}`
**Description:** Get a single category used to tag items in Spotify.
**Link:** [/documentation/web-api/reference/get-a-category](https://developer.spotify.com/documentation/web-api/reference/get-a-category)

---

## Chapters

### Get a Chapter
**Method:** `GET`
**Endpoint:** `/chapters/{id}`
**Description:** Get Spotify catalog information for a single chapter.
**Link:** [/documentation/web-api/reference/get-a-chapter](https://developer.spotify.com/documentation/web-api/reference/get-a-chapter)

### Get Several Chapters
**Method:** `GET`
**Endpoint:** `/chapters`
**Description:** Get Spotify catalog information for several chapters identified by their Spotify IDs.
**Link:** [/documentation/web-api/reference/get-several-chapters](https://developer.spotify.com/documentation/web-api/reference/get-several-chapters)

---

## Episodes

### Get Episode
**Method:** `GET`
**Endpoint:** `/episodes/{id}`
**Description:** Get Spotify catalog information for a single episode.
**Link:** [/documentation/web-api/reference/get-an-episode](https://developer.spotify.com/documentation/web-api/reference/get-an-episode)

### Get Several Episodes
**Method:** `GET`
**Endpoint:** `/episodes`
**Description:** Get Spotify catalog information for several episodes.
**Link:** [/documentation/web-api/reference/get-multiple-episodes](https://developer.spotify.com/documentation/web-api/reference/get-multiple-episodes)

### Get User's Saved Episodes
**Method:** `GET`
**Endpoint:** `/me/episodes`
**Description:** Get a list of the episodes saved in the current Spotify user's library.
**Link:** [/documentation/web-api/reference/get-users-saved-episodes](https://developer.spotify.com/documentation/web-api/reference/get-users-saved-episodes)

### Save Episodes for Current User
**Method:** `PUT`
**Endpoint:** `/me/episodes`
**Description:** Save one or more episodes to the current user's library.
**Link:** [/documentation/web-api/reference/save-episodes-user](https://developer.spotify.com/documentation/web-api/reference/save-episodes-user)

### Remove User's Saved Episodes
**Method:** `DELETE`
**Endpoint:** `/me/episodes`
**Description:** Remove one or more episodes from the current user's library.
**Link:** [/documentation/web-api/reference/remove-episodes-user](https://developer.spotify.com/documentation/web-api/reference/remove-episodes-user)

### Check User's Saved Episodes
**Method:** `GET`
**Endpoint:** `/me/episodes/contains`
**Description:** Check if one or more episodes is already saved in the current Spotify user's library.
**Link:** [/documentation/web-api/reference/check-users-saved-episodes](https://developer.spotify.com/documentation/web-api/reference/check-users-saved-episodes)

---

## Genres

### Get Available Genre Seeds
**Method:** `GET`
**Endpoint:** `/recommendations/available-genre-seeds`
**Description:** Retrieve a list of available genres seed parameter values for recommendations.
**Link:** [/documentation/web-api/reference/get-recommendation-genres](https://developer.spotify.com/documentation/web-api/reference/get-recommendation-genres)

---

## Markets

### Get Available Markets
**Method:** `GET`
**Endpoint:** `/markets`
**Description:** Get the list of markets where Spotify is available.
**Link:** [/documentation/web-api/reference/get-available-markets](https://developer.spotify.com/documentation/web-api/reference/get-available-markets)

---

## Player

### Get Playback State
**Method:** `GET`
**Endpoint:** `/me/player`
**Description:** Get information about the user’s current playback state.
**Link:** [/documentation/web-api/reference/get-information-about-the-users-current-playback](https://developer.spotify.com/documentation/web-api/reference/get-information-about-the-users-current-playback)

### Transfer Playback
**Method:** `PUT`
**Endpoint:** `/me/player`
**Description:** Transfer playback to a new device and determine if it should start playing.
**Link:** [/documentation/web-api/reference/transfer-a-users-playback](https://developer.spotify.com/documentation/web-api/reference/transfer-a-users-playback)

### Get Available Devices
**Method:** `GET`
**Endpoint:** `/me/player/devices`
**Description:** Get information about a user’s available devices.
**Link:** [/documentation/web-api/reference/get-a-users-available-devices](https://developer.spotify.com/documentation/web-api/reference/get-a-users-available-devices)

### Get Currently Playing Track
**Method:** `GET`
**Endpoint:** `/me/player/currently-playing`
**Description:** Get the object currently being played on the user’s Spotify account.
**Link:** [/documentation/web-api/reference/get-the-users-currently-playing-track](https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track)

### Start/Resume Playback
**Method:** `PUT`
**Endpoint:** `/me/player/play`
**Description:** Start a new context or resume current playback on the user’s active device.
**Link:** [/documentation/web-api/reference/start-a-users-playback](https://developer.spotify.com/documentation/web-api/reference/start-a-users-playback)

### Pause Playback
**Method:** `PUT`
**Endpoint:** `/me/player/pause`
**Description:** Pause playback on the user’s account.
**Link:** [/documentation/web-api/reference/pause-a-users-playback](https://developer.spotify.com/documentation/web-api/reference/pause-a-users-playback)

### Skip To Next
**Method:** `POST`
**Endpoint:** `/me/player/next`
**Description:** Skips to next track in the user’s queue.
**Link:** [/documentation/web-api/reference/skip-users-playback-to-next-track](https://developer.spotify.com/documentation/web-api/reference/skip-users-playback-to-next-track)

### Skip To Previous
**Method:** `POST`
**Endpoint:** `/me/player/previous`
**Description:** Skips to previous track in the user’s queue.
**Link:** [/documentation/web-api/reference/skip-users-playback-to-previous-track](https://developer.spotify.com/documentation/web-api/reference/skip-users-playback-to-previous-track)

### Seek To Position
**Method:** `PUT`
**Endpoint:** `/me/player/seek`
**Description:** Seeks to the given position in the user’s currently playing track.
**Link:** [/documentation/web-api/reference/seek-to-position-in-currently-playing-track](https://developer.spotify.com/documentation/web-api/reference/seek-to-position-in-currently-playing-track)

### Set Repeat Mode
**Method:** `PUT`
**Endpoint:** `/me/player/repeat`
**Description:** Set the repeat mode for the user’s playback.
**Link:** [/documentation/web-api/reference/set-repeat-mode-on-users-playback](https://developer.spotify.com/documentation/web-api/reference/set-repeat-mode-on-users-playback)

### Set Playback Volume
**Method:** `PUT`
**Endpoint:** `/me/player/volume`
**Description:** Set the volume for the user’s current playback device.
**Link:** [/documentation/web-api/reference/set-volume-for-users-playback](https://developer.spotify.com/documentation/web-api/reference/set-volume-for-users-playback)

### Toggle Playback Shuffle
**Method:** `PUT`
**Endpoint:** `/me/player/shuffle`
**Description:** Toggle shuffle on or off for user’s playback.
**Link:** [/documentation/web-api/reference/toggle-shuffle-for-users-playback](https://developer.spotify.com/documentation/web-api/reference/toggle-shuffle-for-users-playback)

### Get Recently Played Tracks
**Method:** `GET`
**Endpoint:** `/me/player/recently-played`
**Description:** Get tracks from the current user’s recently played tracks.
**Link:** [/documentation/web-api/reference/get-recently-played](https://developer.spotify.com/documentation/web-api/reference/get-recently-played)

### Get the User's Queue
**Method:** `GET`
**Endpoint:** `/me/player/queue`
**Description:** Get the list of items that constitute the user's current playback queue.
**Link:** [/documentation/web-api/reference/get-queue](https://developer.spotify.com/documentation/web-api/reference/get-queue)

### Add Item to Playback Queue
**Method:** `POST`
**Endpoint:** `/me/player/queue`
**Description:** Add an item to the end of the user’s current playback queue.
**Link:** [/documentation/web-api/reference/add-to-queue](https://developer.spotify.com/documentation/web-api/reference/add-to-queue)

---

## Playlists

### Get Playlist
**Method:** `GET`
**Endpoint:** `/playlists/{playlist_id}`
**Description:** Get a playlist owned by a Spotify user.
**Link:** [/documentation/web-api/reference/get-playlist](https://developer.spotify.com/documentation/web-api/reference/get-playlist)

### Change Playlist Details
**Method:** `PUT`
**Endpoint:** `/playlists/{playlist_id}`
**Description:** Change a playlist’s name and public/private state.
**Link:** [/documentation/web-api/reference/change-playlist-details](https://developer.spotify.com/documentation/web-api/reference/change-playlist-details)

### Get Playlist Items
**Method:** `GET`
**Endpoint:** `/playlists/{playlist_id}/tracks`
**Description:** Get full details of the items of a playlist owned by a Spotify user.
**Link:** [/documentation/web-api/reference/get-playlists-tracks](https://developer.spotify.com/documentation/web-api/reference/get-playlists-tracks)

### Update Playlist Items
**Method:** `PUT`
**Endpoint:** `/playlists/{playlist_id}/tracks`
**Description:** Reorder items in a playlist or replace a playlist’s items.
**Link:** [/documentation/web-api/reference/reorder-or-replace-playlists-tracks](https://developer.spotify.com/documentation/web-api/reference/reorder-or-replace-playlists-tracks)

### Add Items to Playlist
**Method:** `POST`
**Endpoint:** `/playlists/{playlist_id}/tracks`
**Description:** Add one or more items to a user’s playlist.
**Link:** [/documentation/web-api/reference/add-tracks-to-playlist](https://developer.spotify.com/documentation/web-api/reference/add-tracks-to-playlist)

### Remove Playlist Items
**Method:** `DELETE`
**Endpoint:** `/playlists/{playlist_id}/tracks`
**Description:** Remove one or more items from a user’s playlist.
**Link:** [/documentation/web-api/reference/remove-tracks-playlist](https://developer.spotify.com/documentation/web-api/reference/remove-tracks-playlist)

### Get Current User's Playlists
**Method:** `GET`
**Endpoint:** `/me/playlists`
**Description:** Get a list of the playlists owned or followed by the current Spotify user.
**Link:** [/documentation/web-api/reference/get-a-list-of-current-users-playlists](https://developer.spotify.com/documentation/web-api/reference/get-a-list-of-current-users-playlists)

### Get User's Playlists
**Method:** `GET`
**Endpoint:** `/users/{user_id}/playlists`
**Description:** Get a list of the playlists owned or followed by a Spotify user.
**Link:** [/documentation/web-api/reference/get-list-users-playlists](https://developer.spotify.com/documentation/web-api/reference/get-list-users-playlists)

### Create Playlist
**Method:** `POST`
**Endpoint:** `/users/{user_id}/playlists`
**Description:** Create a playlist for a Spotify user.
**Link:** [/documentation/web-api/reference/create-playlist](https://developer.spotify.com/documentation/web-api/reference/create-playlist)

### Get Featured Playlists **[DEPRECATED / RESTRICTED]**
**Method:** `GET`
**Endpoint:** `/browse/featured-playlists`
**Description:** Get a list of Spotify featured playlists.
**Link:** [/documentation/web-api/reference/get-featured-playlists](https://developer.spotify.com/documentation/web-api/reference/get-featured-playlists)

### Get Category's Playlists **[DEPRECATED / RESTRICTED]**
**Method:** `GET`
**Endpoint:** `/browse/categories/{category_id}/playlists`
**Description:** Get a list of Spotify playlists tagged with a particular category.
**Link:** [/documentation/web-api/reference/get-a-categories-playlists](https://developer.spotify.com/documentation/web-api/reference/get-a-categories-playlists)

### Get Playlist Cover Image
**Method:** `GET`
**Endpoint:** `/playlists/{playlist_id}/images`
**Description:** Get the current image associated with a specific playlist.
**Link:** [/documentation/web-api/reference/get-playlist-cover](https://developer.spotify.com/documentation/web-api/reference/get-playlist-cover)

### Add Custom Playlist Cover Image
**Method:** `PUT`
**Endpoint:** `/playlists/{playlist_id}/images`
**Description:** Replace the image used to represent a specific playlist.
**Link:** [/documentation/web-api/reference/upload-custom-playlist-cover](https://developer.spotify.com/documentation/web-api/reference/upload-custom-playlist-cover)

---

## Search

### Search for Item
**Method:** `GET`
**Endpoint:** `/search`
**Description:** Get Spotify catalog information about albums, artists, playlists, tracks, shows, episodes, or audiobooks that match a keyword string.
**Link:** [/documentation/web-api/reference/search](https://developer.spotify.com/documentation/web-api/reference/search)

---

## Shows

### Get Show
**Method:** `GET`
**Endpoint:** `/shows/{id}`
**Description:** Get Spotify catalog information for a single show.
**Link:** [/documentation/web-api/reference/get-a-show](https://developer.spotify.com/documentation/web-api/reference/get-a-show)

### Get Several Shows
**Method:** `GET`
**Endpoint:** `/shows`
**Description:** Get Spotify catalog information for several shows.
**Link:** [/documentation/web-api/reference/get-multiple-shows](https://developer.spotify.com/documentation/web-api/reference/get-multiple-shows)

### Get Show Episodes
**Method:** `GET`
**Endpoint:** `/shows/{id}/episodes`
**Description:** Get Spotify catalog information about an show’s episodes.
**Link:** [/documentation/web-api/reference/get-a-shows-episodes](https://developer.spotify.com/documentation/web-api/reference/get-a-shows-episodes)

### Get User's Saved Shows
**Method:** `GET`
**Endpoint:** `/me/shows`
**Description:** Get a list of shows saved in the current Spotify user's library.
**Link:** [/documentation/web-api/reference/get-users-saved-shows](https://developer.spotify.com/documentation/web-api/reference/get-users-saved-shows)

### Save Shows for Current User
**Method:** `PUT`
**Endpoint:** `/me/shows`
**Description:** Save one or more shows to current Spotify user's library.
**Link:** [/documentation/web-api/reference/save-shows-user](https://developer.spotify.com/documentation/web-api/reference/save-shows-user)

### Remove User's Saved Shows
**Method:** `DELETE`
**Endpoint:** `/me/shows`
**Description:** Delete one or more shows from current Spotify user's library.
**Link:** [/documentation/web-api/reference/remove-shows-user](https://developer.spotify.com/documentation/web-api/reference/remove-shows-user)

### Check User's Saved Shows
**Method:** `GET`
**Endpoint:** `/me/shows/contains`
**Description:** Check if one or more shows is already saved in the current Spotify user's library.
**Link:** [/documentation/web-api/reference/check-users-saved-shows](https://developer.spotify.com/documentation/web-api/reference/check-users-saved-shows)

---

## Tracks

### Get Track
**Method:** `GET`
**Endpoint:** `/tracks/{id}`
**Description:** Get Spotify catalog information for a single track.
**Link:** [/documentation/web-api/reference/get-track](https://developer.spotify.com/documentation/web-api/reference/get-track)

### Get Several Tracks
**Method:** `GET`
**Endpoint:** `/tracks`
**Description:** Get Spotify catalog information for multiple tracks.
**Link:** [/documentation/web-api/reference/get-several-tracks](https://developer.spotify.com/documentation/web-api/reference/get-several-tracks)

### Get User's Saved Tracks
**Method:** `GET`
**Endpoint:** `/me/tracks`
**Description:** Get a list of the songs saved in the current Spotify user's 'Your Music' library.
**Link:** [/documentation/web-api/reference/get-users-saved-tracks](https://developer.spotify.com/documentation/web-api/reference/get-users-saved-tracks)

### Save Tracks for Current User
**Method:** `PUT`
**Endpoint:** `/me/tracks`
**Description:** Save one or more tracks to the current user's 'Your Music' library.
**Link:** [/documentation/web-api/reference/save-tracks-user](https://developer.spotify.com/documentation/web-api/reference/save-tracks-user)

### Remove User's Saved Tracks
**Method:** `DELETE`
**Endpoint:** `/me/tracks`
**Description:** Remove one or more tracks from the current user's 'Your Music' library.
**Link:** [/documentation/web-api/reference/remove-tracks-user](https://developer.spotify.com/documentation/web-api/reference/remove-tracks-user)

### Check User's Saved Tracks
**Method:** `GET`
**Endpoint:** `/me/tracks/contains`
**Description:** Check if one or more tracks is already saved in the current Spotify user's 'Your Music' library.
**Link:** [/documentation/web-api/reference/check-users-saved-tracks](https://developer.spotify.com/documentation/web-api/reference/check-users-saved-tracks)

### Get Several Tracks' Audio Features **[DEPRECATED / RESTRICTED]**
**Method:** `GET`
**Endpoint:** `/audio-features`
**Description:** Get audio features for multiple tracks based on their Spotify IDs.
**Link:** [/documentation/web-api/reference/get-several-audio-features](https://developer.spotify.com/documentation/web-api/reference/get-several-audio-features)

### Get Track's Audio Features **[DEPRECATED / RESTRICTED]**
**Method:** `GET`
**Endpoint:** `/audio-features/{id}`
**Description:** Get audio features for a single track.
**Link:** [/documentation/web-api/reference/get-audio-features](https://developer.spotify.com/documentation/web-api/reference/get-audio-features)

### Get Track's Audio Analysis **[DEPRECATED / RESTRICTED]**
**Method:** `GET`
**Endpoint:** `/audio-analysis/{id}`
**Description:** Get a low-level audio analysis for a track in the Spotify catalog.
**Link:** [/documentation/web-api/reference/get-audio-analysis](https://developer.spotify.com/documentation/web-api/reference/get-audio-analysis)

### Get Recommendations **[DEPRECATED / RESTRICTED]**
**Method:** `GET`
**Endpoint:** `/recommendations`
**Description:** Create a playlist-style listening experience based on seed artists, tracks and genres.
**Link:** [/documentation/web-api/reference/get-recommendations](https://developer.spotify.com/documentation/web-api/reference/get-recommendations)

---

## Users

### Get Current User's Profile
**Method:** `GET`
**Endpoint:** `/me`
**Description:** Get detailed profile information about the current user.
**Link:** [/documentation/web-api/reference/get-current-users-profile](https://developer.spotify.com/documentation/web-api/reference/get-current-users-profile)

### Get User's Top Items
**Method:** `GET`
**Endpoint:** `/me/top/{type}`
**Description:** Get the current user's top artists or tracks.
**Link:** [/documentation/web-api/reference/get-users-top-artists-and-tracks](https://developer.spotify.com/documentation/web-api/reference/get-users-top-artists-and-tracks)

### Get User's Profile
**Method:** `GET`
**Endpoint:** `/users/{user_id}`
**Description:** Get public profile information about a Spotify user.
**Link:** [/documentation/web-api/reference/get-users-profile](https://developer.spotify.com/documentation/web-api/reference/get-users-profile)

### Follow Playlist
**Method:** `PUT`
**Endpoint:** `/playlists/{playlist_id}/followers`
**Description:** Add the current user as a follower of a playlist.
**Link:** [/documentation/web-api/reference/follow-playlist](https://developer.spotify.com/documentation/web-api/reference/follow-playlist)

### Unfollow Playlist
**Method:** `DELETE`
**Endpoint:** `/playlists/{playlist_id}/followers`
**Description:** Remove the current user as a follower of a playlist.
**Link:** [/documentation/web-api/reference/unfollow-playlist](https://developer.spotify.com/documentation/web-api/reference/unfollow-playlist)

### Get Followed Artists
**Method:** `GET`
**Endpoint:** `/me/following`
**Description:** Get the current user's followed artists.
**Link:** [/documentation/web-api/reference/get-followed](https://developer.spotify.com/documentation/web-api/reference/get-followed)

### Follow Artists or Users
**Method:** `PUT`
**Endpoint:** `/me/following`
**Description:** Add the current user as a follower of one or more artists or other Spotify users.
**Link:** [/documentation/web-api/reference/follow-artists-users](https://developer.spotify.com/documentation/web-api/reference/follow-artists-users)

### Unfollow Artists or Users
**Method:** `DELETE`
**Endpoint:** `/me/following`
**Description:** Remove the current user as a follower of one or more artists or other Spotify users.
**Link:** [/documentation/web-api/reference/unfollow-artists-users](https://developer.spotify.com/documentation/web-api/reference/unfollow-artists-users)

### Check If User Follows Artists or Users
**Method:** `GET`
**Endpoint:** `/me/following/contains`
**Description:** Check to see if the current user follows one or more artists or other Spotify users.
**Link:** [/documentation/web-api/reference/check-current-user-follows](https://developer.spotify.com/documentation/web-api/reference/check-current-user-follows)

### Check if Current User Follows Playlist
**Method:** `GET`
**Endpoint:** `/playlists/{playlist_id}/followers/contains`
**Description:** Check to see if one or more Spotify users are following a specified playlist.
**Link:** [/documentation/web-api/reference/check-if-user-follows-playlist](https://developer.spotify.com/documentation/web-api/reference/check-if-user-follows-playlist)
