--[[ Prompt user to enter values for tooLoud and shortLen variables
local retval, input = reaper.GetUserInputs("Set variables", 2, "Overloud Threshold (dB),Short Length (seconds)", "20,2")
if not retval then return end -- exit script if user cancels dialog
local tooLoud, shortLen = input:match("([^,]+),([^,]+)")
tooLoud = tonumber(tooLoud)
shortLen = tonumber(shortLen)
--]]


--- Set variables
tooLoud = 25 -- set maximum allowed volume increase (in dB)
shortLen = 2 
fadeLen = 0.15
overLoud = {} -- array to hold overloud media items

-- Define add_fade_in function to add fade-in to beginning of every item 
function add_fade_in()
    for i = 0, new_selected_items - 1 do 
      local item = reaper.GetSelectedMediaItem(0,i) 
      reaper.SetMediaItemInfo_Value(item,"D_FADEINLEN",fadeLen) 
      reaper.SetMediaItemInfo_Value(item,"D_FADEOUTLEN",fadeLen) 
    end
end

-- Define "find nearest media item" function
function findNearestMediaItem(track, currentItem)
    --reaper.ShowConsoleMsg("Called FindNearest")

    local nearestItem = nil
    local nearestTimeDiff = math.huge

    for i = 1, reaper.CountTrackMediaItems(track) do
        local item = reaper.GetTrackMediaItem(track, i-1)
        if item ~= currentItem then
            local itemStart = reaper.GetMediaItemInfo_Value(item, "D_POSITION")
            local itemEnd = itemStart + reaper.GetMediaItemInfo_Value(item, "D_LENGTH")
            local currentItemStart = reaper.GetMediaItemInfo_Value(currentItem, "D_POSITION")
            local currentItemEnd = currentItemStart + reaper.GetMediaItemInfo_Value(currentItem, "D_LENGTH")
            local timeDiff = math.abs(itemStart - currentItemStart)
            if timeDiff < nearestTimeDiff then
                nearestTimeDiff = timeDiff
                nearestItem = item
            end
            timeDiff = math.abs(itemEnd - currentItemEnd)
            if timeDiff < nearestTimeDiff then
                nearestTimeDiff = timeDiff
                nearestItem = item
            end
        end
    end

    return nearestItem
end

-- Function to check if a media item will clip when played
function checkMediaItemForClipping(item)
  local take = reaper.GetActiveTake(item)
  local peak = reaper.NF_GetMediaItemMaxPeak(item)
  local maxLevel = 0 -- maximum level before clipping
  local takeVol = reaper.GetMediaItemTakeInfo_Value(take, "D_VOL")
  local takeVolDB = 20 * math.log(takeVol,10) -- convert take volume to dB

  -- Determine if the item will clip
  if takeVolDB + peak > 0 then
    -- Calculate the amount of gain reduction required to avoid clipping
    local reductionDB = maxLevel - peak + 0.1
    local reductionLin = 10 ^ (reductionDB / 20) -- convert dB to linear

    -- Reduce the take volume by the calculated amount
    reaper.SetMediaItemTakeInfo_Value(take, "D_VOL", reductionLin)

    return true
  else
    return false
  end
end

function ResetRipple()
  if rippleAll then reaper.Main_OnCommand(40311,0) end
  if ripplePer then reaper.Main_OnCommand(40311,0) end
end

--[[ ===============================================
============== SCRIPT MAIN BODY START ==============
================================================]]--


-- this ripple shit isn't working
local rippleAll = false
local ripplePer = false

local rippleAllState = reaper.GetToggleCommandState(40311) -- all tracks
local ripplePerState = reaper.GetToggleCommandState(40310) -- per track

if rippleAllState == 1 then local rippleAll = true end
if ripplePerState == 1 then local ripplePer = true end

-- Stop transport and turn ripple edit off
reaper.Main_OnCommand(1016, 0) -- Transport: Stop
reaper.Main_OnCommand(40309, 0) -- Options: Ripple editing off
reaper.Main_OnCommand(41923, 0) -- Item: Reset items volume to +0dB

-- Count selected media items
selected_items = reaper.CountSelectedMediaItems(0)
if selected_items == 0 then return end

--[[
videoSources = {}

-- unselect any video items
for i=0, selected_items-1 do
  local itemV = reaper.GetSelectedMediaItem(0,i)
  local sourceV = reaper.GetMediaItemTake_Source(reaper.GetMediaItemTake(itemV,0))
  local sourceType = reaper.GetMediaSourceType(sourceV)
  if sourceType == "VIDEO" then 
    table.insert(videoSources,itemV)
  end
end

for _,video in ipairs(videoSources) do
  reaper.SetMediaItemSelected(video,false)
end

reaper.UpdateArrange()
selected_items = reaper.CountSelectedMediaItems(0)
--]]


reaper.Undo_BeginBlock()
-- Normalize selected media items to 0 LUFS using SWS/BR action
reaper.Main_OnCommand(reaper.NamedCommandLookup("_BR_NORMALIZE_LOUDNESS_ITEMS_LU"), 0)

reaper.Undo_EndBlock("Normalize",0)
-- Launch Dynamic Split feature
reaper.Main_OnCommand(40760, 0)
-- Wait for number of selected media items to change
function wait_for_change()
    new_selected_items = reaper.CountSelectedMediaItems(0)
    if new_selected_items == 0 then ResetRipple() return end
    if new_selected_items < selected_items then ResetRipple() return end
    if new_selected_items > selected_items then
        reaper.Undo_BeginBlock()
        -- Normalize new media items to -23 LUFS if number of selected media items increases
        reaper.Main_OnCommand(reaper.NamedCommandLookup("_BR_NORMALIZE_LOUDNESS_ITEMS23"), 0)

        -- Check for overloud media items and add to overLoud array
        for i = 0, new_selected_items - 1 do
            local itemL = reaper.GetSelectedMediaItem(0, i)
            local takeL = reaper.GetActiveTake(itemL)
            local vol = reaper.GetMediaItemTakeInfo_Value(takeL, "D_VOL")
            if 20 * math.log(vol, 10) > tooLoud then
                table.insert(overLoud, itemL)
            end
        end
        
        -- Delete overloud media items in overLoud array
        for _, itemO in ipairs(overLoud) do
             groupId = reaper.GetMediaItemInfo_Value(itemO,"I_GROUPID")
            if groupId ~= 0 then
              numItems = reaper.CountMediaItems(0)
              for ill=0, numItems-1 do
                checkItem = reaper.GetMediaItem(-1,ill)
                if checkItem ~= nil then
                  if reaper.GetMediaItemInfo_Value(checkItem,"I_GROUPID") == groupId then
                    reaper.DeleteTrackMediaItem(reaper.GetMediaItem_Track(checkItem),checkItem)
                  end
                end
              end
            end
            reaper.DeleteTrackMediaItem(reaper.GetMediaItem_Track(itemO),itemO)
           
        end--]]
        
        new_selected_items = reaper.CountSelectedMediaItems(0)

        -- Set take volume of short media items to same as next nearest item on same track
        for i = 0, new_selected_items - 1 do
            local itemS = reaper.GetSelectedMediaItem(0, i)
            local item_len = reaper.GetMediaItemInfo_Value(itemS, "D_LENGTH")
            
            if item_len < shortLen then
                local trackS = reaper.GetMediaItem_Track(itemS)
                local next_item = findNearestMediaItem(trackS,itemS)
                if next_item ~= nil then
                    local takeS = reaper.GetActiveTake(itemS)
                    local next_take = reaper.GetActiveTake(next_item)
                    local next_vol = reaper.GetMediaItemTakeInfo_Value(next_take, "D_VOL")
                    local current_vol = reaper.GetMediaItemTakeInfo_Value(takeS, "D_VOL")
                    local volDiff =(current_vol - next_vol)*0.5
                    
                    --reaper.ShowConsoleMsg("next vol " .. next_vol .. "\nCurrent Vol " .. current_vol .. "\nVolDiff " .. volDiff)
                    
                    if current_vol > next_vol then
                      reaper.SetMediaItemTakeInfo_Value(takeS, "D_VOL", current_vol + volDiff)
                    end
                      
                end
            end
            
           -- checkMediaItemForClipping(item)
            
            
        end

        -- Add fade-in to beginning of every item using custom function (see previous message for function definition)
        add_fade_in()

        -- Crossfade any overlapping items using SWS action
        reaper.Main_OnCommand(41059, 0)
        

        reaper.UpdateArrange()
        
        reaper.Undo_EndBlock("Coffee Cup",0)
        
    else
        -- Continue waiting if number of selected media items does not change
        reaper.defer(wait_for_change)
    end
end

-- Call wait_for_change function after launching Dynamic Split feature
reaper.defer(wait_for_change)