--[[--
YOU MUST HAVE AMAZON CLI AND POLLY SET UP FOR THIS TO WORK.
I CAN NOT HELP YOU WITH THIS. IT IS ANNOYING ASF.
IF YOU CAN GET THAT SET UP THO, THIS LETS YOU CALL IT INSIDE REAPER SUPER EASILY
--]]--

-- Configuration
local numFields = 2 -- Number of text input fields
local fieldNames = {"Voice Name:", "Text:", "extrawidth=500","separator=\n"} -- Names for each field
local defaultValues = {"Matthew", "Your Text Here"} -- Default values for each field

listNames = "aws polly describe-voices --output json --query \"Voices[].[Id, Gender, LanguageName]\""
reaper.ClearConsole()
nameList = reaper.ExecProcess(listNames,0)
reaper.ShowConsoleMsg(tostring(nameList))
nameList = nameList:gsub('%[','')
nameList = nameList:gsub('%]','')
nameList = nameList:gsub('"','')
nameList = nameList:gsub(' ','')
nameList = nameList:gsub(',','')
nameList = nameList:gsub('%d','')


local currentSet = {}
local count = 0

for name in nameList:gmatch("[^\n]+") do
    if name ~= "" and name:match("%S") then
        table.insert(currentSet, name)
        
        if #currentSet == 3 then
            count = count + 1
            currentSet[1] = 'Voice Name: "' .. currentSet[1] .. '"'
            local setName = table.concat(currentSet, " - ")
            reaper.ShowConsoleMsg(setName .. "\n")
            currentSet = {}
        end
    end
end

-- Display the last set if it contains less than three names
if #currentSet > 0 then
    count = count + 1
    local setName = table.concat(currentSet, " - ")
    reaper.ShowConsoleMsg(setName .. "\n")
end


-- Function to display the user input dialog
function showInputDialog()
  local inputValues = {} -- Table to store user input values

  -- Generate the default values string
  local defaultValuesStr = table.concat(defaultValues, "\n")

  -- Prompt the user for input
  local retval, input = reaper.GetUserInputs("PodCube Text to Speech", numFields, table.concat(fieldNames, "\n"), defaultValuesStr,5000)

  -- Check if the user canceled the input dialog
  if not retval then
    return nil -- Exit the function without storing any values
  end

  -- Parse the user input values
  local parsedInput = {}

  for value in input:gmatch("[^\n]+") do
    table.insert(parsedInput, value)
  end--]]

  -- Store the user input values
  for i = 1, numFields do
    if parsedInput[i] and parsedInput[i] ~= "" then
      inputValues[i] = parsedInput[i]
    else
      inputValues[i] = defaultValues[i]
    end
  end

  return inputValues -- Return the table of user input values
end

-- Run the input dialog
local userInput = showInputDialog()
-- Check if the user provided any input
if userInput then
  local textString = userInput[2]
  -- Print the user input values

local voiceName = userInput[1]
ct = 0

reaper.Main_OnCommand(40100,0)
local destFile = reaper.GetProjectPath().."\\"..reaper.GetProjectName(0):sub(1,-5).."_"..voiceName.."_TTS.mp3"
while reaper.file_exists(destFile) do
  if reaper.file_exists(destFile:sub(1,-5)..tostring(ct)..".mp3") then
    ct = ct+1
  else
    destFile = destFile:sub(1,-5)..tostring(ct)..".mp3"
  end
end
reaper.Main_OnCommand(40101,0)
local command = "aws polly synthesize-speech --output-format mp3 --voice-id "..voiceName.." --text \""..textString.."\" \""..destFile.."\""
local retval = reaper.ExecProcess(command,0)

reaper.PreventUIRefresh(1)
reaper.InsertMedia(destFile,0)
reaper.PreventUIRefresh(-1)

else
  reaper.ShowMessageBox("Input canceled by the user.","Canceled",0)
end