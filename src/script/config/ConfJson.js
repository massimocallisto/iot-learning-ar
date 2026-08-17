let data = null;

export const jsonStore = {
  async setFromFileInput(file) {
    if (!file) return;
    data = JSON.parse(await file.text());
    return data;
  },

  get() {
    return data;
  },

  getRegole() {
    return Array.isArray(data?.regole) ? data.regole : [];
  }
};
