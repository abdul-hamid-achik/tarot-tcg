// contentlayer.config.ts
import { defineDocumentType, makeSource } from "contentlayer2/source-files";
var Card = defineDocumentType(() => ({
  name: "Card",
  filePathPattern: "cards/**/*.mdx",
  contentType: "mdx",
  fields: {
    id: {
      type: "string",
      required: true
    },
    name: {
      type: "string",
      required: true
    },
    zodiacClass: {
      type: "enum",
      options: ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"],
      required: true
    },
    element: {
      type: "enum",
      options: ["fire", "earth", "air", "water"],
      required: true
    },
    cardType: {
      type: "enum",
      options: ["unit", "spell"],
      required: true
    },
    cost: {
      type: "number",
      required: true
    },
    attack: {
      type: "number",
      required: false
    },
    health: {
      type: "number",
      required: false
    },
    rarity: {
      type: "enum",
      options: ["common", "uncommon", "rare", "legendary", "mythic"],
      required: true
    },
    tarotNumber: {
      type: "string",
      required: false
    },
    tarotSymbol: {
      type: "string",
      required: true
    },
    description: {
      type: "string",
      required: false
    },
    reversedDescription: {
      type: "string",
      required: false
    },
    orientation: {
      type: "string",
      required: false
    },
    suitSymbol: {
      type: "string",
      required: false
    },
    keywords: {
      type: "list",
      of: { type: "string" },
      required: false
    },
    abilities: {
      type: "json",
      required: false
    },
    spellType: {
      type: "enum",
      options: ["instant", "ritual", "enchantment"],
      required: false
    },
    effects: {
      type: "json",
      required: false
    }
  },
  computedFields: {
    url: {
      type: "string",
      resolve: (card) => `/${card._raw.flattenedPath}`
    },
    zodiacPath: {
      type: "string",
      resolve: (card) => card.zodiacClass
    },
    isUnit: {
      type: "boolean",
      resolve: (card) => card.cardType === "unit"
    },
    isSpell: {
      type: "boolean",
      resolve: (card) => card.cardType === "spell"
    }
    // Validation computed fields temporarily disabled due to build issues
  }
}));
var ZodiacClass = defineDocumentType(() => ({
  name: "ZodiacClass",
  filePathPattern: "classes/**/*.mdx",
  contentType: "mdx",
  fields: {
    title: {
      type: "string",
      required: true
    },
    description: {
      type: "string",
      required: true
    }
  },
  computedFields: {
    url: {
      type: "string",
      resolve: (doc) => `/classes/${doc._raw.flattenedPath}`
    }
  }
}));
var MetaGuide = defineDocumentType(() => ({
  name: "MetaGuide",
  filePathPattern: "*-meta.mdx",
  contentType: "mdx",
  fields: {
    title: {
      type: "string",
      required: true
    },
    description: {
      type: "string",
      required: true
    }
  },
  computedFields: {
    url: {
      type: "string",
      resolve: (doc) => `/meta/${doc._raw.flattenedPath.replace("-meta", "")}`
    }
  }
}));
var contentlayer_config_default = makeSource({
  contentDirPath: "./content",
  documentTypes: [Card, ZodiacClass, MetaGuide],
  mdx: {
    remarkPlugins: [],
    rehypePlugins: []
  },
  disableImportAliasWarning: true
});
export {
  Card,
  MetaGuide,
  ZodiacClass,
  contentlayer_config_default as default
};
//# sourceMappingURL=compiled-contentlayer-config-SMZKOTUR.mjs.map
