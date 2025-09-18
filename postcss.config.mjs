const plugins = [];

if (process.env.NODE_ENV !== "test") {
  plugins.push("@tailwindcss/postcss");
}

const config = {
  plugins,
};

export default config;
