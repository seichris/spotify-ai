interface PlaybackQueueTrack {
  id: string;
  uri: string;
}

export const buildPlaybackQueue = (
  tracks: PlaybackQueueTrack[],
  selectedTrackId: string,
) => {
  const uniqueTracks = Array.from(
    new Map(tracks.map((track) => [track.id, track])).values(),
  );
  const selectedIndex = uniqueTracks.findIndex(
    (track) => track.id === selectedTrackId,
  );

  if (selectedIndex < 0) return [];

  return [
    ...uniqueTracks.slice(selectedIndex),
    ...uniqueTracks.slice(0, selectedIndex),
  ].map((track) => track.uri);
};
