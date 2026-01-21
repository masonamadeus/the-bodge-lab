--[[--
			  !!!!IMPORTANT!!!!

--> FOR THIS TO WORK YOU MUST HAVE FFMPEG.EXE INSIDE YOUR REAPER\USERPLUGINS FOLDER <--

YOU CAN DOWNLOAD FFMPEG.EXE HERE: https://www.ffmpeg.org/download.html

--]]--

-- @description Extract Multi-Channel Audio Streams (FFPMEG.EXE MUST BE IN USERPLUGINS FOLDER)

function log(m) reaper.ShowConsoleMsg(tostring(m) .. "\n") end

-- Clear console
reaper.ShowConsoleMsg("")
log("=== Starting Extraction Script v2.4 ===")

local platform = reaper.GetOS()
local is_windows = string.match(platform, "Win")

-- MAPPING: FFmpeg Codec Name -> Target Extension
local codec_map = {
    pcm_s16le = "wav", pcm_s24le = "wav", pcm_s32le = "wav", pcm_f32le = "wav",
    aac = "m4a", mp3 = "mp3", ac3 = "ac3", eac3 = "ec3", flac = "flac",
    opus = "ogg", vorbis = "ogg"
}

function EscapePath(path)
    if is_windows then return '"' .. path .. '"' else return "'" .. path:gsub("'", "'\\''") .. "'" end
end

function GetBinaryPath(binary_name)
    local sep = is_windows and "\\" or "/"
    local ext = is_windows and ".exe" or ""
    local paths = {
        reaper.GetExePath() .. sep .. binary_name .. ext,
        reaper.GetExePath() .. sep .. "UserPlugins" .. sep .. binary_name .. ext,
        reaper.GetResourcePath() .. sep .. "UserPlugins" .. sep .. binary_name .. ext
    }
    for _, path in ipairs(paths) do
        if reaper.file_exists(path) then return EscapePath(path) end
    end
    return binary_name
end

function GetFileSize(path)
    local f = io.open(path, "rb")
    if not f then return 0 end
    local size = f:seek("end")
    f:close()
    return size
end

function Main()
    local item = reaper.GetSelectedMediaItem(0, 0)
    if not item then reaper.ShowMessageBox("Select a video item.", "Error", 0) return end

    local take = reaper.GetActiveTake(item)
    local source = reaper.GetMediaItemTake_Source(take)
    local filepath = reaper.GetMediaSourceFileName(source, "")
    
    if filepath == "" then reaper.ShowMessageBox("File is offline/invalid.", "Error", 0) return end

    local ffmpeg = GetBinaryPath("ffmpeg")
    local ffprobe = GetBinaryPath("ffprobe")
    
    -- Generate a short timestamp ID to prevent "Permission Denied" on re-runs
    local unique_id = tostring(os.time()):sub(-4)

    -- 1. PROBE
    local probe_cmd = ffprobe .. ' -v error -select_streams a -show_entries stream=index,codec_name -of csv=p=0 ' .. EscapePath(filepath)
    local probe_out = reaper.ExecProcess(probe_cmd, 0)
    
    if not probe_out then reaper.ShowMessageBox("FFprobe failed to run.", "Error", 0) return end

    local streams = {}
    for line in probe_out:gmatch("[^\r\n]+") do
        local idx, codec = line:match("^(%d+),(.*)$")
        if idx then table.insert(streams, {index = idx, codec = codec}) end
    end

    if #streams == 0 then
        reaper.ShowMessageBox("No audio streams found.", "Info", 0)
        return
    end

    -- 2. BUILD COMMAND
    local dir, filename, original_ext = filepath:match("^(.*)[\\/](.*)%.(.*)$")
    if is_windows then dir = dir .. "\\" else dir = dir .. "/" end
    
    local cmd_args = ' -i ' .. EscapePath(filepath)
    local output_files = {}
    
    log("Extracting " .. #streams .. " streams...")

    for i, stream in ipairs(streams) do
        local ext = codec_map[stream.codec] or original_ext
        -- Added unique_id to filename to bypass file locks
        local out_name = filename .. "_Track_" .. i .. "_" .. stream.codec .. "_" .. unique_id .. "." .. ext
        local full_path = dir .. out_name
        
        table.insert(output_files, full_path)
        
        cmd_args = cmd_args .. ' -map 0:a:' .. (i-1) .. ' -c copy -vn -sn -y ' .. EscapePath(full_path)
    end

    -- 3. EXECUTE
    reaper.PreventUIRefresh(1)
    reaper.Undo_BeginBlock()
    
    local final_cmd = ffmpeg .. cmd_args
    local extract_out = reaper.ExecProcess(final_cmd, 0)
    
    -- 4. IMPORT
    local track = reaper.GetMediaItem_Track(item)
    local track_idx = reaper.GetMediaTrackInfo_Value(track, "IP_TRACKNUMBER")
    local item_pos = reaper.GetMediaItemInfo_Value(item, "D_POSITION")
    local item_len = reaper.GetMediaItemInfo_Value(item, "D_LENGTH") -- Store original length

    local imported_count = 0

    for i, file in ipairs(output_files) do
        -- Check size to ensure we don't import 0-byte errors
        local size = GetFileSize(file)
        
        if size > 1000 then -- Arbitrary small bytes check to ensure valid header
            reaper.InsertTrackAtIndex(track_idx + i - 1, true)
            local new_track = reaper.GetTrack(0, track_idx + i - 1)
            local codec_name = streams[i].codec:upper()
            
            reaper.GetSetMediaTrackInfo_String(new_track, "P_NAME", filename .. " " .. i .. " (" .. codec_name .. ")", true)
            
            local new_item = reaper.AddMediaItemToTrack(new_track)
            local new_take = reaper.AddTakeToMediaItem(new_item)
            
            local src_ok = false
            if reaper.BR_SetTakeSourceFromFile then
                src_ok = reaper.BR_SetTakeSourceFromFile(new_take, file, false)
            end
            
            if not src_ok then
                local src = reaper.PCM_Source_CreateFromFile(file)
                if src then
                    reaper.SetMediaItemTake_Source(new_take, src)
                    src_ok = true
                end
            end

            -- Corrected: API requires 3 arguments
            reaper.SetMediaItemPosition(new_item, item_pos, false)
            
            -- Corrected: Force the new item to match the original video length
            reaper.SetMediaItemInfo_Value(new_item, "D_LENGTH", item_len)
            
            imported_count = imported_count + 1
        else
            log("Error: File " .. i .. " was not created correctly (0 bytes or missing).\n" .. file)
        end
    end

    reaper.UpdateArrange()
    reaper.Undo_EndBlock("Extract Audio Streams", -1)
    reaper.PreventUIRefresh(-1)
    
    if imported_count == 0 then
        reaper.ShowMessageBox("Extraction failed. Check console for details.\n\nFFmpeg output:\n" .. (extract_out or ""), "Error", 0)
    else
        log("Successfully extracted " .. imported_count .. " tracks.")
        reaper.Main_OnCommand(40047, 0) -- Build any missing peaks
    end
end

Main()