--[[--

RECOMMENDED HOTKEY: SHIFT + SPACE

SET THIS TO YOUR HOTKEY OF CHOICE.
PRESS THE HOTKEY ONCE TO JUMP UP TO 1.5x SPEED.
PRESS AGAIN TO RETURN TO NORMAL SPEED.

IF YOU ADJUST THE HIGHER SPEED, THE SCRIPT WILL REMEMBER AND TOGGLE BETWEEN YOUR CHOSEN SPEED AND NORMAL 1x PLAYBACK.

GREAT FOR NON-PRECISE, RAPID EDITING OF TALK PODCASTS OR INTERVIEWS, ETC.

DON'T FORGET TO RIGHT-CLICK THE SPEED CONTROL WHEEL (TOP RIGHT OF SCREEN BY DEFAULT) AND ENABLE "PRESERVE PITCH".

--]]--

function speedUp()
  reaper.Undo_BeginBlock()
  reaper.CSurf_OnPlayRateChange(1.5)
  reaper.Undo_EndBlock("Play Faster",-1) 
end

function speedNormal()
  playrateNow = reaper.Master_GetPlayRate(0)
  reaper.SetExtState("AltPlayrate","AltPlayrate",playrateNow,true)
  reaper.Main_OnCommand(40521,0) 
end

function speedAlt()
  altPlayrate = reaper.GetExtState("AltPlayrate","AltPlayrate")
  if altPlayrate == "" then
    SpeedUp()
  else
    reaper.CSurf_OnPlayRateChange(altPlayrate)
  end
end

altPlayrate = reaper.GetExtState("AltPlayrate","AltPlayrate")
startingPlayrate = reaper.Master_GetPlayRate(0)
if startingPlayrate ~= 1 then
  speedNormal()
else
  speedAlt() 
end
--reaper.Main_OnCommand(1007,0) --PLAY