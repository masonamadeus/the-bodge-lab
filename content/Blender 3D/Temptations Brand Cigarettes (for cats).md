# Temptations Brand Cat Cigarettes 3D Model

### I got the urge to play around with UV mapping and this is what happened...

{%image "./files/TEMPTATIONS_LQ.webp", "Mason's 3D rendition of Temptations brand cat cigarettes on a small wooden table."%}

{%grid%}

I took a jpeg from the Temptations website, and then whipped up a quick pack of cigarettes in Blender.

The plastic wrapping was fun, I used Blender's (new at the time) cloth brush in the sculpt menu and just pushed around some vertices. The wrinkles came out pretty cool!

Here's the 3D model! Tthe textures are a little bit fucked up because I don't know how to export them without spending a bunch of time baking stuff.

They call GLB the "JPEG of 3D models" and that's really exciting, but the complexities of materials and textures makes it tricky to support things like procedural shaders.

The reason the cigarette tips are white is that I used Blender's "Noise Texture" node on that part, and GLB doesn't support ALL procedural textures (because it would have to support literally every node type in every 3D software). So it just shows up white. Whatever.

Please don't actually let your cat smoke anything. Literally not anything can be smoked by your cat. Nothing. If you catch your cat smoking, you should talk to them as soon as possible. You'll want to be sure you find out where they got it, too, so that you can remove the source.

This is the only way.
``

{% 3d "https://assets.bodgelab.com/3D/CATCIGS.glb" %}

{%endgrid%}