interface BarcodeDetector {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

declare var BarcodeDetector: {
  prototype: BarcodeDetector;
  new (options?: { formats?: string[] }): BarcodeDetector;
};


