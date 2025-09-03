import { TransactionWorker } from "../modules/transaction/transaction.worker"

export const initializedWorkers = () => {
    //add other worker here
    new TransactionWorker()
}