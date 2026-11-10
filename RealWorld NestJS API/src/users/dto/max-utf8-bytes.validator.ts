import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function MaxUtf8Bytes(
  maximumBytes: number,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'maxUtf8Bytes',
      target: target.constructor,
      propertyName: String(propertyKey),
      constraints: [maximumBytes],
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return (
            typeof value === 'string' &&
            Buffer.byteLength(value, 'utf8') <= maximumBytes
          );
        },
        defaultMessage(arguments_: ValidationArguments): string {
          return `${arguments_.property} must be at most ${String(maximumBytes)} UTF-8 bytes`;
        },
      },
    });
  };
}
