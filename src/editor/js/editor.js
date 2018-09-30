import Vue from "./vue.js";
import map from "lodash/map";
import { Game } from "../../client/game";

new Vue({
    el: "#editor",
    data() {
        return {
            game_running: false,
            game_inst: null,

            brush: "wall",
            brush_options: [
                { type: "wall", style: { background: "#697478" } },
                { type: "player", style: { background: "cornflowerblue" } },
                { type: "bullet-pickup", style: { background: "#b87ecf" } }
            ],
            select_object: null,
            draw_object: null,
            draw_object_origin: { x: 0, y: 0 },
            grid: {
                cell_size: 32,
                rows: 16,
                cols: 16
            },
            level: {
                objects: []
            }
        };
    },
    computed: {
        viewportClass() {
            if (this.draw_object !== null) {
                return "mode--drawing";
            }
        },
        levelStyle() {
            const { cols, rows, cell_size } = this.grid;
            return {
                width: cols * cell_size + "px",
                height: rows * cell_size + "px"
            };
        },
        cellStyle() {
            return {
                width: this.grid.cell_size + "px",
                height: this.grid.cell_size + "px"
            };
        },
        levelRects() {
            const { cell_size } = this.grid;
            const colors = this.brush_options.reduce((colors, opt) => {
                colors[opt.type] = opt.style.background;
                return colors;
            }, {});
            return map(this.level.objects, obj => {
                const { x, y, w, h } = obj;
                const style = {
                    background: colors[obj.type],
                    top: y * cell_size + "px",
                    left: x * cell_size + "px",
                    width: w * cell_size + "px",
                    height: h * cell_size + "px"
                };

                const classList = [];
                if (this.select_object && this.select_object.id === obj.id) {
                    classList.push("selected");
                }

                return { obj, style, classList };
            });
        }
    },
    watch: {
        "level.objects": function(objects) {
            const objIds = objects.map(obj => obj.id);
            const missing = obj => obj && objIds.indexOf(obj.id) === -1;

            if (missing(this.select_object)) {
                this.select_object = null;
            }

            if (missing(this.draw_object)) {
                this.draw_object = null;
            }
        }
    },
    methods: {
        isObjResizable(obj) {
            return obj.type === "wall";
        },
        getMouseGridPoint(ev) {
            function getOffset(object, offset = { x: 0, y: 0 }) {
                if (!object) return offset;
                offset.x += object.offsetLeft;
                offset.y += object.offsetTop;

                return getOffset(object.offsetParent, offset);
            }

            const grid = getOffset(this.$refs.grid);
            const point = {
                x: ev.clientX - grid.x,
                y: ev.clientY - grid.y
            };

            return {
                x: Math.floor(point.x / this.grid.cell_size),
                y: Math.floor(point.y / this.grid.cell_size)
            };
        },
        onDelete(ev) {
            if (this.select_object !== null) {
                this.level.objects = this.level.objects.filter(obj => {
                    return obj.id !== this.select_object.id;
                });
            }
        },
        drawObjectBegin(ev, obj = null) {
            if (this.draw_object === null) {
                const { x, y } = this.getMouseGridPoint(ev);
                this.draw_object_origin = { x, y };
                this.draw_object = this.createObject(x, y);
                this.select_object = this.draw_object;
            }
        },
        drawObject(ev) {
            if (this.draw_object !== null) {
                const { x, y } = this.getMouseGridPoint(ev);
                if (this.isObjResizable(this.draw_object)) {
                    const origin = this.draw_object_origin;
                    const min = {
                        x: Math.min(x, origin.x),
                        y: Math.min(y, origin.y)
                    };
                    const max = {
                        x: Math.max(x, origin.x),
                        y: Math.max(y, origin.y)
                    };

                    this.draw_object.x = min.x;
                    this.draw_object.y = min.y;
                    this.draw_object.w = max.x - min.x + 1;
                    this.draw_object.h = max.y - min.y + 1;
                } else {
                    this.draw_object.x = x;
                    this.draw_object.y = y;
                    this.draw_object.w = 1;
                    this.draw_object.h = 1;
                }
            }
        },
        drawObjectEnd() {
            if (this.draw_object !== null) {
                this.draw_object = null;
            }
        },
        createObject(x, y, w = 1, h = 1) {
            const id = Date.now().toString(16);
            const type = this.brush;
            const obj = { id, type, x, y, w, h };
            this.level.objects.push(obj);
            return obj;
        },
        selectObject(obj) {
            this.select_object = obj;
        },
        resizeObj(obj, point) {
            this.draw_object = obj;
            this.select_object = obj;
            switch (point) {
                case "tl": {
                    this.draw_object_origin = {
                        x: obj.x + obj.w - 1,
                        y: obj.y + obj.h - 1
                    };
                    break;
                }
                case "tr": {
                    this.draw_object_origin = {
                        x: obj.x,
                        y: obj.y + obj.h - 1
                    };
                    break;
                }
                case "bl": {
                    this.draw_object_origin = {
                        x: obj.x + obj.w - 1,
                        y: obj.y
                    };
                    break;
                }
                case "br": {
                    this.draw_object_origin = {
                        x: obj.x,
                        y: obj.y
                    };
                    break;
                }
            }
        },
        setBrush(brush) {
            this.brush = brush;
        },
        exportJSON() {
            const TILE_SIZE = 12;
            const vector3 = vec2 => ({
                x: vec2.x,
                y: TILE_SIZE,
                z: vec2.y
            });

            const srcObjects = this.level.objects.concat({
                id: "floor",
                type: "wall",
                x: 0,
                y: 0,
                w: Math.max(...this.level.objects.map(o => o.x + o.w)),
                h: Math.max(...this.level.objects.map(o => o.y + o.h))
            });

            const objects = srcObjects.map((obj, index) => {
                const x = obj.x * TILE_SIZE;
                const y = obj.y * TILE_SIZE;
                const w = obj.w * TILE_SIZE;
                const h = obj.h * TILE_SIZE;

                return {
                    id: obj.id,
                    type: obj.type,
                    position: vector3({
                        x: x + w * 0.5,
                        y: y + h * 0.5
                    }),
                    size: vector3({
                        x: w,
                        y: h
                    })
                };
            });

            // Move floor down
            objects.filter(o => o.id === "floor").forEach(floor => {
                floor.position.y -= TILE_SIZE;
            });

            // Download the file
            const a = document.createElement("a");
            const json = JSON.stringify(objects);
            const file = new Blob([json], { type: "json" });
            a.href = URL.createObjectURL(file);
            a.download = "level.json";
            a.click();
        },
        playLevel(play) {
            this.game_running = play;

            if (this.game_running) {
                this.game_inst = new Game();
                this.$nextTick().then(() => {
                    this.game_inst.container = this.$refs.gameScreen;
                    this.game_inst.run();
                });
            } else {
                this.game_inst.destroy();
                this.game_inst = null;
            }
        }
    },
    mounted() {
        document.addEventListener("keydown", ev => {
            switch (ev.keyCode) {
                case 27:
                    this.onEscape(ev);
                    break;
                case 46:
                    this.onDelete(ev);
                    break;
                default:
                    break;
            }
        });
    }
});
