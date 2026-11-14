const PLAN = {
  start: "2026-11-14",
  totalDays: 14,
  revision: "Consulta de revisión: viernes 27 de noviembre",
  menu: [
    { w: 1, d: "Lunes", desayuno: "Café y revuelto con aguacate y jamón", comida: "Barquitas de endivias", merienda: "Nueces", cena: "Calamares a la plancha" },
    { w: 1, d: "Martes", desayuno: "Café, yogur natural entero, avellanas y jamón serrano", comida: "Solomillo de buey a la plancha", merienda: "Queso manchego semicurado", cena: "Berenjenas con tomate y setas" },
    { w: 1, d: "Miércoles", desayuno: "Café y revuelto con nueces y salmón ahumado", comida: "Pisto y crema de calabaza", merienda: "Yogur natural entero", cena: "Lubina horneada con hierbas" },
    { w: 1, d: "Jueves", desayuno: "Café y revuelto con pavo y mozzarella", comida: "Salmón a la plancha", merienda: "Pistachos", cena: "Ensalada de tomates y aceitunas, y puré de verduras" },
    { w: 1, d: "Viernes", desayuno: "Café y revuelto de setas", comida: "Crema suave de calabaza y zanahoria, ensalada de rúcula y olivas", merienda: "Queso de Burgos", cena: "Conejo a la brasa" },
    { w: 1, d: "Sábado", desayuno: "Café, aguacate, avellanas y jamón York", comida: "Rape a la plancha", merienda: "Yogur natural entero", cena: "Verduras asadas" },
    { w: 1, d: "Domingo", desayuno: "Café y revuelto con aguacate y bacón", comida: "Ensalada de judías verdes", merienda: "Pistachos", cena: "Rodaballo al horno" },
    { w: 2, d: "Lunes", desayuno: "Café y nido de queso fundido con yema a la plancha", comida: "Salmón al horno con costra de pistachos (batch cooking)", merienda: "Queso de Burgos", cena: "Coliflor a la italiana y ensalada aliñada" },
    { w: 2, d: "Martes", desayuno: "Café, queso fresco batido, avellanas y jamón serrano", comida: "Espaguetis de calabacín a la crema verde", merienda: "Queso manchego semicurado", cena: "Ternera asada al horno" },
    { w: 2, d: "Miércoles", desayuno: "Café y revuelto con aguacate y salmón ahumado", comida: "Medallones de pulpo al pimentón y AOVE (batch cooking)", merienda: "Nueces", cena: "Abanico de la huerta al horno (batch cooking)" },
    { w: 2, d: "Jueves", desayuno: "Café, huevo a la plancha, queso manchego semicurado, jamón serrano y pechuga de pavo", comida: "Tartar de bonito, tomate y aguacate, crema verde", merienda: "Yogur natural entero", cena: "Sardinas a la brasa" },
    { w: 2, d: "Viernes", desayuno: "Café y tortilla de mozzarella con tomate", comida: "Pollo al limón", merienda: "Pistachos", cena: "Champiñones a la cazuela y crema de zanahorias" },
    { w: 2, d: "Sábado", desayuno: "Café, aguacate, avellanas y jamón serrano", comida: "Ensalada de cogollos y tomates, guarnición de escalibada", merienda: "Yogur natural entero", cena: "Dorada a la parrilla" },
    { w: 2, d: "Domingo", desayuno: "Café y tortitas de huevo y mozzarella", comida: "Bonito fresco", merienda: "Queso de Burgos", cena: "Calabacines con tomates, setas, pimiento y cebolla" }
  ],
  combos: [
    {
      name: "Opción A",
      desayuno: ["Café solo", "Tortilla de 1-2 huevos", "Pavo", "Nueces"],
      merienda: ["Yogur griego natural entero", "Colágeno"]
    },
    {
      name: "Opción B",
      desayuno: ["Café solo", "Yogur griego natural entero", "Jamón serrano", "Nueces"],
      merienda: ["Queso de Burgos"]
    }
  ],
  comboNote: "Variación opcional: algunos días, sustituye las nueces del desayuno A por aguacate (dos fuentes de grasas saludables del plan).",
  proteins: [
    { n: "Salmón al horno con costra de pistachos", tag: "Mantener", note: "Tu salmón habitual con un toque diferente" },
    { n: "Solomillo de buey", tag: "Mantener", note: "Equivale a tu opción de ternera" },
    { n: "Rape a la plancha", tag: "Alternativa", note: "Muy sencillo, igual que la merluza" },
    { n: "Medallones de pulpo al pimentón", tag: "Alternativa", note: "Prácticamente sin cocinar si lo compras cocido" },
    { n: "Tartar de bonito", tag: "Alternativa", note: "Fácil si lo compras preparado y es apto para consumir en crudo" },
    { n: "Pollo al limón", tag: "Mantener", note: "Puedes hacerlo directamente a la plancha con limón" },
    { n: "Sardinas", tag: "Mantener", note: "Tu opción de conserva es perfectamente práctica" }
  ],
  veggies: [
    { n: "Bandeja de verduras al horno", note: "Tu preparación estrella: haces cantidad y tiras de ella varios días" },
    { n: "Crema de calabaza, zanahoria y puerro", note: "Para varios días; congela raciones individuales" },
    { n: "Crema de calabacín", note: "La crema sencilla: sin nata ni quesitos" },
    { n: "Ensalada de bolsa con tomate", note: "La de los días de pereza: lista en dos minutos" },
    { n: "Champiñones a la sartén", note: "7-10 min con AOVE, ajo y perejil" },
    { n: "Calabacín a la sartén", note: "Rodajas o dados, 3-4 min por lado" }
  ],
  shop: [
    {
      name: "Semana 1 · 14–20 nov",
      groups: [
        { g: "Carne", items: ["240 g de solomillo de buey", "250 g de conejo"] },
        { g: "Embutidos", items: ["20 g de bacón", "40 g de jamón York", "50 g de jamón serrano", "30 g de pechuga de pavo"] },
        { g: "Pescado y marisco", items: ["250 g de salmón", "20 g de salmón ahumado", "250 g de calamares", "240 g de lubina", "240 g de rape", "250 g de rodaballo"] },
        { g: "Lácteos y quesos", items: ["380 g de yogur natural entero", "80 g de queso de Burgos", "20 g de queso mozzarella", "40 g de queso manchego semicurado"] },
        { g: "Huevos", items: ["280 g de huevo (5-6 huevos)"] },
        { g: "Fruta", items: ["100 g de aguacate", "70 g de limón"] },
        { g: "Frutos secos", items: ["40 g de avellanas", "40 g de nueces sin cáscara", "40 g de pistachos"] },
        { g: "Verduras y hortalizas", items: ["260 g de berenjenas", "90 g de calabacín", "330 g de cebollas", "10 g de cebollino", "170 g de endivias", "120 g de patatas", "290 g de pimiento", "50 g de puerros", "100 g de setas", "50 g de rúcula", "490 g de tomate", "160 g de zanahorias", "240 g de calabaza", "300 g de judías verdes"] },
        { g: "Salmuera", items: ["50 g de aceitunas negras", "20 g de aceitunas verdes"] },
        { g: "Despensa", items: ["100 g de aceite de oliva", "350 g de café natural", "10 g de pimienta negra", "10 g de ajo", "10 g de sal", "10 g de zumo de limón"] }
      ]
    },
    {
      name: "Semana 2 · 21–27 nov",
      groups: [
        { g: "Carne", items: ["250 g de lomo de ternera", "200 g de pechuga de pollo"] },
        { g: "Embutidos", items: ["80 g de lacón", "50 g de jamón York", "80 g de jamón serrano", "40 g de pechuga de pavo"] },
        { g: "Pescado y marisco", items: ["250 g de bonito fresco", "230 g de salmón", "20 g de salmón ahumado", "240 g de sardinas", "240 g de dorada", "250 g de pulpo"] },
        { g: "Lácteos y quesos", items: ["60 g de leche entera", "250 g de yogur natural entero", "160 g de queso de Burgos", "120 g de queso fresco batido", "130 g de queso mozzarella", "80 g de queso manchego semicurado"] },
        { g: "Huevos", items: ["270 g de huevo (5 huevos)"] },
        { g: "Fruta", items: ["200 g de aguacate", "100 g de limón"] },
        { g: "Frutos secos", items: ["40 g de avellanas", "20 g de nueces sin cáscara", "40 g de pistachos"] },
        { g: "Verduras y hortalizas", items: ["180 g de berenjenas", "30 g de brécol", "600 g de calabacín", "140 g de cebollas", "10 g de cebollino", "120 g de champiñones", "170 g de cogollos", "110 g de coliflor", "80 g de espinacas", "50 g de lechuga", "20 g de patatas", "210 g de pimiento", "40 g de puerros", "70 g de setas", "80 g de tomate cherry", "700 g de tomate", "170 g de zanahorias"] },
        { g: "Salmuera", items: ["10 g de aceitunas negras", "10 g de aceitunas verdes"] },
        { g: "Despensa", items: ["100 g de aceite de oliva", "350 g de café natural", "10 g de caldo vegetal", "10 g de orégano seco", "10 g de tomillo", "10 g de albahaca", "10 g de pimentón", "10 g de pimienta negra", "10 g de ajo", "10 g de sal", "10 g de zumo de limón"] }
      ]
    }
  ]
};
