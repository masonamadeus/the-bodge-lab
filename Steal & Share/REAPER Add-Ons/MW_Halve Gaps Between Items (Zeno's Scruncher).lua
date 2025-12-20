--[[--
  IT'S ZENO'S DICHOTOMY PARADOX TURNED USEFUL!
  
  THIS "SCRUNCHES" ITEMS TOGETHER, REDUCING THE GAPS BETWEEN THEM BY EXACTLY HALF EACH TIME.
  
  THIS IS USEFUL IF YOU'RE BEING LAZY AFTER RUNNING MY COFFEE CUP SCRIPT AND JUST WANT TO 'TIGHTEN IT ALL UP'.
  
  OR YOU CAN SPAM IT TO BRING ALL YOUR ITEMS REALLY CLOSE TOGETHER. THE WORLD IS YOUR OYSTER.
--]]--

-- Percentage to move the next media item backwards
local movePercentage = 0.5 -- Adjust this value if you want.

-- Get the selected media items
local numSelectedItems = reaper.CountSelectedMediaItems(0)

-- Iterate through the selected media items
for i = 0, numSelectedItems - 1 do
  local currentItem = reaper.GetSelectedMediaItem(0, i)
  local currentItemEnd = reaper.GetMediaItemInfo_Value(currentItem, "D_POSITION") + reaper.GetMediaItemInfo_Value(currentItem, "D_LENGTH")
  
  -- Check if there is a next item
  if i < numSelectedItems - 1 then
    local nextItem = reaper.GetSelectedMediaItem(0, i + 1)
    local nextItemStart = reaper.GetMediaItemInfo_Value(nextItem, "D_POSITION")
    local distance = nextItemStart - currentItemEnd
    
    -- Move the next item backwards by the user-defined percentage of the distance
    local moveAmount = distance * movePercentage
    
    -- Adjust subsequent items' positions
    for j = i + 1, numSelectedItems - 1 do
      local itemToMove = reaper.GetSelectedMediaItem(0, j)
      local itemPosition = reaper.GetMediaItemInfo_Value(itemToMove, "D_POSITION")
      reaper.SetMediaItemPosition(itemToMove, itemPosition - moveAmount, false)
    end
  end
end

-- Update the arrangement to reflect the changes
reaper.UpdateArrange()