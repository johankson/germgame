# GERM GAME

This is (or supposed to be) a proof of concept for a germ simulator game running in the browser.

It's not in any way using any science facts to accomplish this and the main mechanics of the game is not really a germ by name either.

The player starts as a single cell. The cell is made up of vertices in a circle, let's say 100 vertices. Each vertice has two neighbours and each of those are slightly angled from each other in the rest state. If no forces are applied to the cell, they will form a "perfect" circle. If a force is applied, the vertices wants to get back to the rest state. The more you push the more they will push back. Like it's attached to a spring.

This can be accomplished by using some 2d physics library. The cell is suspended in liquid so we can assume that the gravity would simply be set to zero. The inerta will have to be a bit higher since we are also assuming that the cell is suspended in a liquid.

The drawing can be simple, but it needs to handle lines and simple vector graphics and filling of shapes. Texturing is a nice to have.

The proof of concept will be an example for how gameplay should look when we implement it in some other framework, perhaps MonoGame or in C++ with some cool library.

## Tech specs

- Typescript
- Running in browser
- Physics simulation (in 0 G)
- Graphics lib that can handle lines and filling shapes, texturing is a nice to have

## Step 1

Technical test

- [ ] Add basic stuff to CLAUDE.md regarding development using the frameworks choosen
- [ ] Create the base project with typescript and import libraries that are needed for physics and graphics
- [ ] Setup a gitignore file
- [ ] Create a blank canvas that the game will use to draw
- [ ] Set up a main gameplay loop
- [ ] Create the cell out of 100 vertices
- [ ] Add simple movement controls, listening to the arrow keys
- [ ] Implement movement to push or drag the cell