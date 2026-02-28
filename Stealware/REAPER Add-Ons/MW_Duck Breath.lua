--[[
# DESCRIPTION: THIS WILL 'DUCK' (TURN DOWN) WHATEVER ITEM IS SELECTED, BUT ONLY INSIDE THE CURRENT TIME SELECTION.

IT WILL RAMP DOWN AND BACK UP GENTLY ENOUGH. I USE THIS TO MAKE BREATHS QUIETER WHEN THEY'RE TOO UNRULY, BUT YOU COULD USE IT ON WHATEVER

# USAGE:
	- MAKE A TIME SELECTION AROUND THE BREATH YOU WANT TO ATTENUATE.
	- MAKE SURE YOU HAVE THE ITEM(S) SELECTED AS WELL.
	- FIRE THE SCRIPT VIA HOTKEY OR ACTIONS MENU.
	- I HAVE THIS BOUND TO MY 'B' KEY.

## DETAILS: IT USES THE TAKE GAIN ENVELOPE SO THAT THE DUCK STICKS TO THE ITEM AND YOU DON'T HAVE TO WORRY ABOUT ADDITIONAL AUTOMATION.

--]]--

-- User variables
local pointB_offset = 0.05 -- seconds after start of time selection
local pointC_offset = 0.05 -- seconds before end of time selection
local pointBC_value = -12 -- dB

-- Check for time selection
local startTime, endTime = reaper.GetSet_LoopTimeRange(false, false, 0, 0, false)
if startTime == endTime then
  reaper.ShowMessageBox("Please make a time selection", "Error", 0)
  return
end

-- Check for selected media items
local numSelectedItems = reaper.CountSelectedMediaItems(0)
if numSelectedItems == 0 then
  reaper.ShowMessageBox("Please select at least one media item", "Error", 0)
  return
end

-- Iterate over selected media items
for i = 0, numSelectedItems - 1 do
  local item = reaper.GetSelectedMediaItem(0, i)
  local itemStart = reaper.GetMediaItemInfo_Value(item, "D_POSITION")
  local itemEnd = itemStart + reaper.GetMediaItemInfo_Value(item, "D_LENGTH")
  
  -- Check if media item is within time selection
  if itemStart < endTime and itemEnd > startTime then
    local take = reaper.GetActiveTake(item)
    if take then
      -- Show take volume envelope
      reaper.Main_OnCommand(reaper.NamedCommandLookup("_S&M_TAKEENVSHOW1"), 0)
      
      -- Get take volume envelope
      local env = reaper.GetTakeEnvelopeByName(take, "Volume")
      if env then
        -- Calculate envelope points positions and values
        local pointA_pos = math.max(startTime, itemStart)
        local pointB_pos = math.min(pointA_pos + pointB_offset, endTime)
        local pointC_pos = math.max(endTime - pointC_offset, startTime)
        local pointD_pos = math.min(endTime, itemEnd)
        local pointA_val = reaper.ScaleToEnvelopeMode(1, 1) -- 0 dB
        local pointD_val = pointA_val
        local pointBC_val = reaper.ScaleToEnvelopeMode(1, math.exp(pointBC_value*0.11512925464970228420089957273422)) -- convert dB to envelope value
        
        -- Insert envelope points based on media item position relative to time selection
        if itemEnd < endTime then -- Media item ends before time selection ends
          reaper.InsertEnvelopePoint(env, pointA_pos - itemStart, pointA_val ,0 ,0,true)
          reaper.InsertEnvelopePoint(env ,pointB_pos -itemStart ,pointBC_val ,0 ,0,true)
        elseif itemStart > startTime then -- Media item starts after time selection starts
          -- Set value of first envelope point to pointBC_val
          local _, valueOut = reaper.GetEnvelopePoint(env ,0)
          reaper.SetEnvelopePoint(env ,0 ,valueOut ,pointBC_val ,0,0 ,true)

          -- Insert envelope points C&D
          reaper.InsertEnvelopePoint(env ,pointC_pos -itemStart ,pointBC_val ,0 ,0,true)
          reaper.InsertEnvelopePoint(env ,pointD_pos -itemStart ,pointD_val ,0 ,0,true)
        else -- Media item spans entire time selection
          reaper.InsertEnvelopePoint(env ,pointA_pos -itemStart ,pointA_val ,0 ,0,true)
          reaper.InsertEnvelopePoint(env ,pointB_pos -itemStart ,pointBC_val ,0 ,0,true)
          reaper.InsertEnvelopePoint(env ,pointC_pos -itemStart ,pointBC_val ,0 ,0,true)
          reaper.InsertEnvelopePoint(env ,pointD_pos -itemStart ,pointD_val ,0 ,0,true)
        end
        
        -- Sort and commit envelope points
        reaper.Envelope_SortPoints(env)
      end
    end
  end
end

reaper.Main_OnCommand(40331,0)

-- Update arrange view
reaper.UpdateArrange()