---
tags:
  - REAPER
  - Video Processor
uid: '879656e3'
contentHash: bb2feee4
date: '2025-12-15T22:58:44.459Z'
---

# Windows 2000 Style Popup Textbox

{%image "images/win2kpopupprev.webp"%}

Fully programmatically created Win2k style popups, in fucking REAPER.

I'm in love.

Titlebar, gradient, button glyphs - colorable fill && text, and SO accurate it's hard to tell from the pic that it ain't real

Plus, it auto-fits the text, which comes from the item name making it EASY TO USE!

```eel2
// WIN2K FRAME + TITLE + FILL + OPTIONAL ITEM TEXT
// Author: Mason Amadeus (with help from REAPERBLOG)
// License: Ur only allowed to make cool shit with it

//@param1:px 'Position X' 0 0 2560 1280 1
//@param2:py 'Position Y' 0 0 1440 720 1
//@param3:ht 'Height' 500 0 2560 1280 1
//@param4:wi 'Width' 600 0 2560 1280 1

//@param6:contentSize 'Text Size' 50 0 120 50 1
//@param7:autoSize 'Auto-Size Frame' 1 0 1 0.5 1
//@param8:autoMaxWidth 'Auto-Size Width' 400 100 2560 1200 1

//@param10:fillH 'Fill Hue' 0 0 1 0.5 0.01
//@param11:fillS 'Fill Saturation' 0 0 1 0.5 0.01
//@param12:fillV 'Fill Value' 1 0 1 0.5 0.01

//@param14:textH 'Text Hue' 0 0 1 0.5 0.01
//@param15:textS 'Text Saturation' 0 0 1 0.5 0.01
//@param16:textV 'Text Value' 0 0 1 0.5 0.01

//@param18:A 'Frame Opacity' 1 0 1 0.5 0.01
//@param19:fillA 'Fill Opacity' 1 0 1 0.5 0.01
//@param20:textA 'Text Opacity' 1 0 1 0.5 0.01

//@param22:showHint 'Show Hints' 0 0 1 0 1

// --------- USER CONFIGURABLE STUFF ------------ //

// Titlebar Text
#title = "Wicked Interesting";

// Main content text - ONLY OVERRIDE IF YOU HAVE TO.
// If left blank, it will use the item's active take name.
#content = "";

// Make sure you type the name correctly && the font must be installed on your computer.
#font_titlebar = "Segoe UI Bold";
#font_content = "Segoe UI";



// --------- NO TOUCHY UNLESS UR SURE ------------- //

//LET BELOW VIDEOS SHOW THRU (NEED FURTHER TESTING)
colorspace='RGBA';
(bg_img=input_ismaster() ? -2 : input_track(0));
  // Ensure gfx_mode is clean for the background blit.
  gfx_mode = 0;
  gfx_a2 = 0;
  gfx_blit(bg_img, 1);
// TRANSPARENCY HACK END

// this sets the content text to the item's active take name.
strcmp(#content,"")==0 ? input_get_name(-1,#content);

// This should allow the popup to show atop other videos.
input = 0;
gfx_blit(input,1);

// --- HSV to RGB Conversion Logic
// Input vars: h_in, s_in, v_in
// Output vars: r_out, g_out, b_out

// --- Convert Fill Color
h_in = fillH; s_in = fillS; v_in = fillV;
s_in == 0 ? (
    fill_r = fill_g = fill_b = v_in;
) : (
    h_scaled = h_in * 360;
    h_sector = floor(h_scaled / 60);
    f = h_scaled/60 - h_sector;
    p = v_in * (1 - s_in);
    q = v_in * (1 - s_in * f);
    t = v_in * (1 - s_in * (1 - f));
    h_sector == 0 ? ( fill_r = v_in; fill_g = t; fill_b = p; );
    h_sector == 1 ? ( fill_r = q; fill_g = v_in; fill_b = p; );
    h_sector == 2 ? ( fill_r = p; fill_g = v_in; fill_b = t; );
    h_sector == 3 ? ( fill_r = p; fill_g = q; fill_b = v_in; );
    h_sector == 4 ? ( fill_r = t; fill_g = p; fill_b = v_in; );
    h_sector == 5 ? ( fill_r = v_in; fill_g = p; fill_b = q; );
);

// --- Convert Text Color
h_in = textH; s_in = textS; v_in = textV;
s_in == 0 ? (
    text_r = text_g = text_b = v_in;
) : (
    h_scaled = h_in * 360;
    h_sector = floor(h_scaled / 60);
    f = h_scaled/60 - h_sector;
    p = v_in * (1 - s_in);
    q = v_in * (1 - s_in * f);
    t = v_in * (1 - s_in * (1 - f));
    h_sector == 0 ? ( text_r = v_in; text_g = t; text_b = p; );
    h_sector == 1 ? ( text_r = q; text_g = v_in; text_b = p; );
    h_sector == 2 ? ( text_r = p; text_g = v_in; text_b = t; );
    h_sector == 3 ? ( text_r = p; text_g = q; text_b = v_in; );
    h_sector == 4 ? ( text_r = t; text_g = p; text_b = v_in; );
    h_sector == 5 ? ( text_r = v_in; text_g = p; text_b = q; );
);


// -------------------- AUTO-SIZING CALCULATION
autoSize > 0 && strlen(#content) > 0 ? (
  gfx_setfont(contentSize, #font_content, 0);
  
  #calc_line = "";
  #calc_word = "";
  #calc_char = " ";
  num_lines = 1;
  max_line_w = 0;
  line_h = 0;
  
  i = 0;
  loop(strlen(#content) + 1,
    is_end_of_string = i == strlen(#content);
    ch = is_end_of_string ? 32 : str_getchar(#content, i);
    
    ch == 32 && strlen(#calc_word) > 0 ? (
      gfx_str_measure(#calc_line, current_line_w, current_h);
      gfx_str_measure(#calc_word, word_w, word_h);
      line_h = max(line_h, word_h);

      (strlen(#calc_line) > 0 && current_line_w + word_w > autoMaxWidth) ? (
        max_line_w = max(max_line_w, current_line_w);
        num_lines += 1;
        #calc_line = #calc_word;
      ) : (
        strlen(#calc_line) > 0 ? #calc_line += " ";
        #calc_line += #calc_word;
      );
      #calc_word = "";
    );
    
    ch != 32 ? (
      str_setchar(#calc_char, 0, ch);
      #calc_word += #calc_char;
    );
    i += 1;
  );

  gfx_str_measure(#calc_line, last_line_w, last_h);
  max_line_w = max(max_line_w, last_line_w);
  line_h = max(line_h, last_h);
  
  final_line_h = line_h > 0 ? line_h : contentSize;

  final_content_w = max_line_w + 24;
  final_content_h = num_lines * final_line_h + 8;
  
  wi = final_content_w + 10;
  ht = final_content_h + 20;
);


// integer geometry
px2 = floor(px);
py2 = floor(py);
wi2 = floor(wi);
ht2 = floor(ht);

// -------------------- BORDER BEVELS GALORE --- //
gfx_set(223/255,223/255,223/255,A,0);
gfx_fillrect(px2, py2, wi2, 1);
gfx_fillrect(px2, py2+1, 1, ht2-1);
gfx_set(0,0,0,A,0);
gfx_fillrect(px2, py2+ht2-1, wi2, 1);
gfx_fillrect(px2+wi2-1, py2+1, 1, ht2-2);

gfx_set(1,1,1,A,0);
gfx_fillrect(px2+1, py2+1, wi2-2, 1);
gfx_fillrect(px2+1, py2+2, 1, ht2-3);
gfx_set(128/255,128/255,128/255,A,0);
gfx_fillrect(px2+1, py2+ht2-2, wi2-2, 1);
gfx_fillrect(px2+wi2-2, py2+2, 1, ht2-4);

gfx_set(192/255,192/255,192/255,A,0);
gfx_fillrect(px2+2, py2+2, wi2-4, 2);
gfx_fillrect(px2+2, py2+ht2-4, wi2-4, 2);
gfx_fillrect(px2+2, py2+4, 2, ht2-8);
gfx_fillrect(px2+wi2-4, py2+4, 2, ht2-8);

gfx_set(128/255,128/255,128/255,A,0);
gfx_fillrect(px2+4, py2+4, wi2-8, 1);
gfx_fillrect(px2+4, py2+5, 1, ht2-10);
gfx_set(1,1,1,A,0);
gfx_fillrect(px2+4, py2+ht2-5, wi2-8, 1);
gfx_fillrect(px2+wi2-5, py2+5, 1, ht2-10);

gfx_set(192/255,192/255,192/255,A,0);
gfx_fillrect(px2+5, py2+5, wi2-10, 1);
gfx_fillrect(px2+5, py2+6, 1, ht2-11);
gfx_set(223/255,223/255,223/255,A,0);
gfx_fillrect(px2+5, py2+ht2-6, wi2-10, 1);
gfx_fillrect(px2+wi2-6, py2+6, 1, ht2-12);


// --------------------- TITLE BAR ----- //
titlebar_h = 20;
tb_x = px2+4;
tb_y = py2+4;
tb_w = wi2-8;
tb_h = titlebar_h;

// Crazy gradient logic
steps = tb_w > 0 ? tb_w : 1;
i = 0;
loop(steps,
  t = i/(steps-1 + (steps==1));
  r = (0*(1-t) + 16*t)/255;
  g = (0*(1-t) + 132*t)/255;
  b = (128*(1-t) + 208*t)/255;
  gfx_set(r,g,b,A,0);
  gfx_fillrect(tb_x+i, tb_y, 1, tb_h);
  i += 1;
);

// Title text
gfx_setfont(20,#font_titlebar,0);
gfx_set(1,1,1,A,0);
gfx_str_measure(#title,titleW,titleH);
gfx_str_draw(#title,tb_x+4,tb_y + (tb_h - titleH)/2);

// -------------------- MAIN CONTENT FILL -- //
content_x = px2 + 5;
content_y = py2 + 24;
content_w = wi2 - 10;
content_h = ht2 - 28;

// Draw customizable fill using HSV-derived colors
gfx_set(fill_r, fill_g, fill_b, fillA, 0);
gfx_fillrect(content_x, content_y, content_w, content_h);

// Content Area Bevel
gfx_set(128/255,128/255,128/255,A,0);
gfx_fillrect(content_x, content_y, content_w, 1);
gfx_fillrect(content_x, content_y+1, 1, content_h-2);
gfx_set(1,1,1,A,0);
gfx_fillrect(content_x, content_y+content_h-1, content_w, 1);
gfx_fillrect(content_x+content_w-1, content_y+1, 1, content_h-2);


// -------------------- CONTENT TEXT ---- //
  contentSize > 0 && strlen(#content) > 0 ? (
  gfx_setfont(contentSize,#font_content,0);
  
  // Use customizable, HSV-derived text color
  gfx_set(text_r, text_g, text_b, textA, 0); 
  
  max_w = content_w - 16;
  ypos = content_y - 10;
  #line = "";
  #word = "";
  #char = " ";
  i = 0;
  
  loop(strlen(#content) + 1,
      is_end_of_string = i == strlen(#content);
      ch = is_end_of_string ? 32 : str_getchar(#content, i);
      
      ch == 32 && strlen(#word) > 0 ? (
          gfx_str_measure(#line, line_w, line_h);
          gfx_str_measure(#word, word_w, word_h);
          
          (strlen(#line) > 0 && line_w + word_w > max_w) ? (
              gfx_str_draw(#line, content_x + 8, ypos);
              ypos += line_h > 0 ? line_h : contentSize;
              #line = #word;
          ) : (
              strlen(#line) > 0 ? #line += " ";
              #line += #word;
          );
          #word = "";
      );
      
      ch != 32 ? (
          str_setchar(#char, 0, ch);
          #word += #char;
      );
      i += 1;
  );
  
  strlen(#line) > 0 ? gfx_str_draw(#line, content_x + 8, ypos);
);


// --------------------- BUTTONS
btn_size = tb_h-5;
close_x = tb_x + tb_w - btn_size-2;
max_x   = close_x - btn_size-2;
min_x   = max_x - btn_size;
btn_y   = tb_y+3;

button_x = min_x;
loop(3,
  gfx_set(192/255,192/255,192/255,A,0);
  gfx_fillrect(button_x,btn_y,btn_size,btn_size);

  gfx_set(1,1,1,A,0);
  gfx_fillrect(button_x, btn_y, btn_size, 1);
  gfx_fillrect(button_x, btn_y, 1, btn_size);
  gfx_set(0,0,0,A,0);
  gfx_fillrect(button_x, btn_y+btn_size-1, btn_size, 1);
  gfx_fillrect(button_x+btn_size-1, btn_y, 1, btn_size);

  gfx_set(223/255,223/255,223/255,A,0);
  gfx_fillrect(button_x+1, btn_y+1, btn_size-2, 1);
  gfx_fillrect(button_x+1, btn_y+1, 1, btn_size-2);
  gfx_set(128/255,128/255,128/255,A,0);
  gfx_fillrect(button_x+1, btn_y+btn_size-2, btn_size-2, 1);
  gfx_fillrect(button_x+btn_size-2, btn_y+1, 1, btn_size-2);
  
  button_x == min_x ? button_x = max_x : button_x = close_x;
);


// ---------------------- GLYPHS
gfx_set(0,0,0,A,0);

// MINIMIZE
glyph_w = btn_size/2.5;
glyph_h = 2;
glyph_x = min_x + (btn_size - glyph_w)/2;
glyph_y = btn_y + btn_size - 6;
gfx_fillrect(glyph_x,glyph_y,glyph_w,glyph_h);

// MAXIMIZE
glyph_w = btn_size/1.5;
glyph_h = glyph_w;
glyph_x = max_x + (btn_size - glyph_w)/2+1;
glyph_y = btn_y + (btn_size - glyph_h)/2 +1;
gfx_fillrect(glyph_x,glyph_y,glyph_w-1,1);
gfx_fillrect(glyph_x,glyph_y+1,glyph_w-1,1);
gfx_fillrect(glyph_x,glyph_y+glyph_h-2,glyph_w-1,1);
gfx_fillrect(glyph_x,glyph_y,1,glyph_h-1);
gfx_fillrect(glyph_x+glyph_w-2,glyph_y,1,glyph_h-1);

// CLOSE
glyph_inset = 3;
glyph_start_x = close_x + glyph_inset;
glyph_start_y = btn_y + glyph_inset;
glyph_size = btn_size - (glyph_inset * 2);

i=0;
loop(glyph_size-1,
  gfx_fillrect(glyph_start_x + i, glyph_start_y + i, 2, 1);
  gfx_fillrect(glyph_start_x + (glyph_size-2) - i, glyph_start_y + i, 2, 1);
  i+=1;
);


// --------------------- HINTS AND DEBUG
showHint ==1 ? (
  gfx_setfont(30,#font_content, 0);
  gfx_set(1,1,1,1,0); // Hint text remains fully opaque
  sprintf(#text1,"Win2K Frame %.f×%.f @ %.f,%.f",wi,ht,px,py);
  gfx_str_measure(#text1,sizeX,sizeY);
  gfx_str_draw(#text1,px,py-sizeY);
);
```



Copy/Paste that into your Video Processor Preset and hit save.

