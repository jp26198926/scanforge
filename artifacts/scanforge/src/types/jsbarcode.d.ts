declare module 'jsbarcode' {
  type BarcodeOptions = {
    format?: string;
    displayValue?: boolean;
    lineColor?: string;
    background?: string;
    margin?: number;
    width?: number;
    height?: number;
    fontSize?: number;
  };

  type JsBarcodeApi = (element: SVGElement | HTMLCanvasElement, value: string, options?: BarcodeOptions) => void;
  const JsBarcode: JsBarcodeApi;
  export default JsBarcode;
}