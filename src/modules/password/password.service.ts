import { compare, hash } from "bcrypt";

export class PasswordService {
  hashPassword = async (password: string) => {
    const salt = 10;
    return await hash(password, salt);
  };

  comparePassword = async (plainPassword: string, hashPassword: string) => {
    return await compare(plainPassword, hashPassword);
  };
}
