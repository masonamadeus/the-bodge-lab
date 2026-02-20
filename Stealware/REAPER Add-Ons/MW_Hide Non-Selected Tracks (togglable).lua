--[[--

THIS IS A SIMPLE UTILITY TO HELP YOU VISUALLY FILTER OUT TRACKS JUST BY CLICKING ON THEM.

# USAGE:

1. SELECT SOME TRACKS THAT YOU WANT TO SEE.
2. DON'T SELECT ANY TRACKS THAT YOU DON'T WANT TO SEE.
3. RUN THE SCRIPT.

OH BOY! NOW IT'S ONLY THE TRACKS YOU WANTED TO SEE!
THE OTHER ONES ARE NOW INVISIBLE (BUT WILL STILL PLAY, SO DON'T FORGET ABOUT THEM)

RUN THE SCRIPT AGAIN WHILE ANY TRACKS ARE HIDDEN TO SHOW ALL TRACKS AGAIN.

WITH LOVE, MASON AMADEUS
--]]--

-- get the number of tracks in the project
num_tracks = reaper.CountTracks(0)
tracksHidden = false

-- iterate over all tracks
for i = 0, num_tracks - 1 do
    -- get the current track
    track = reaper.GetTrack(0, i)
    
    -- check if the track is visible in the TCP
    if reaper.IsTrackVisible(track, false) == false then
        tracksHidden = true
        break
    end
end

if tracksHidden then
  reaper.Main_OnCommand(reaper.NamedCommandLookup("_SWSTL_SHOWALL"), 0)
else
  reaper.Main_OnCommand(reaper.NamedCommandLookup("_SWS_TOGZOOMTTHIDE"), 0)
end
