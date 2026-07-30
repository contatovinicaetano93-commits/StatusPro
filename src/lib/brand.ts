export type StatusProBrand = {
  productName: string;
  displayName: string;
  shortMonogram: string;
  locationSubtitle: string;
  tagline: string;
  loginSubtitle: string;
  hojeTitle: string;
};

export function getBrand(): StatusProBrand {
  return {
    productName: "StatusPro",
    displayName: "StatusPro",
    shortMonogram: "SP",
    locationSubtitle: "CEO",
    tagline: "Cockpit de decisão · limpeza & papel",
    loginSubtitle: "Acesse o cockpit com seu perfil. Senha demo: demo",
    hojeTitle: "Pulse do dia",
  };
}
