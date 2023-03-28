import { getCorsHeader } from '../helpers/network';
import { DownloadReq, DownloadRes, UploadReq } from '../../lib/ptp/protobuf/PTPFile';
import { Pdu } from '../../lib/ptp/protobuf/BaseMsg';
import { storage } from '../helpers/env';
import { ERR } from '../../lib/ptp/protobuf/PTPCommon/types';
import { FileInfo } from '../../lib/ptp/protobuf/PTPCommon';
import Logger from "../share/utils/Logger";

export async function Upload(pdu: Pdu) {
	const req = UploadReq.parseMsg(pdu);
	const { id, part, part_total, size, type } = req.file;
	Logger.log('[UPLOAD]', { id, part, part_total, size, type });
	await storage.put(`media/${id}_${part + 1}`, new FileInfo(req.file).encode());
	return new Response('', {
		status: 200,
		headers: {
			...getCorsHeader(),
		},
	});
}

export async function Download(pdu: Pdu) {
	const req = DownloadReq.parseMsg(pdu);
	Logger.log('[Download]', req);
	let body;
	try {
		let i = 1;
		let fileInfo;
		while (true) {
			const res = await storage.get(`media/${req.id}_${i}`);
			const fileInfo1 = new FileInfo().decode(Uint8Array.from(res!));
			if (!fileInfo) {
				fileInfo = fileInfo1;
			} else {
				fileInfo.buf = Buffer.concat([Buffer.from(fileInfo.buf), Buffer.from(fileInfo1.buf)]);
			}
			if (fileInfo1.part_total && fileInfo1.part_total > 1) {
				if (fileInfo1.part_total === i) {
					break;
				}
				i++;
			} else {
				break;
			}
		}

		body = Buffer.from(
			new DownloadRes({
				file: fileInfo,
				err: ERR.NO_ERROR,
			})
				.pack()
				.getPbData()
		);
	} catch (e) {
		console.error(e);
		body = Buffer.from(
			new DownloadRes({
				err: ERR.ERR_SYSTEM,
			})
				.pack()
				.getPbData()
		);
	}
	return new Response(body, {
		status: 200,
		headers: {
			...getCorsHeader(),
		},
	});
}
