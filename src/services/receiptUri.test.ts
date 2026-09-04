import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDurableReceiptUri, pickReceiptUriToStore, resolveReceiptUriToPersist } from './receiptUri';

describe('isDurableReceiptUri', () => {
  it('rejects missing and ephemeral capture URIs', () => {
    assert.equal(isDurableReceiptUri(null), false);
    assert.equal(isDurableReceiptUri(undefined), false);
    assert.equal(isDurableReceiptUri(''), false);
    assert.equal(isDurableReceiptUri('blob:http://localhost:8081/abc'), false);
    assert.equal(isDurableReceiptUri('ph://A1B2C3'), false);
    assert.equal(
      isDurableReceiptUri('file:///var/mobile/Containers/Data/Application/ABC/Library/Caches/ImageManipulator/x.jpg'),
      false,
    );
  });

  it('accepts cloud download URLs and on-device receipts folder copies', () => {
    assert.equal(
      isDurableReceiptUri('https://firebasestorage.googleapis.com/v0/b/expense-tracker-da669.appspot.com/o/users%2Fx%2Freceipts%2Fa.jpg?alt=media&token=1'),
      true,
    );
    assert.equal(
      isDurableReceiptUri('file:///var/mobile/Containers/Data/Application/ABC/Documents/receipts/123.jpg'),
      true,
    );
  });
});

describe('pickReceiptUriToStore', () => {
  it('prefers a cloud URL, then a durable local copy, and never stores a cache/blob URI', () => {
    const cloud = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/a.jpg?alt=media';
    const durable = 'file:///var/mobile/Containers/Data/Application/ABC/Documents/receipts/123.jpg';
    const cache = 'file:///var/mobile/Containers/Data/Application/ABC/Library/Caches/ImageManipulator/x.jpg';

    assert.equal(pickReceiptUriToStore(cloud, durable), cloud);
    assert.equal(pickReceiptUriToStore(null, durable), durable);
    assert.equal(pickReceiptUriToStore(cache, null), null);
    assert.equal(pickReceiptUriToStore(null, null), null);
  });
});

describe('resolveReceiptUriToPersist', () => {
  const cloud = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/a.jpg?alt=media';
  const cache = 'file:///var/mobile/Containers/Data/Application/ABC/Library/Caches/ImageManipulator/x.jpg';

  it('stores nothing while cloud storage is off, even if a URL looks durable', () => {
    assert.equal(resolveReceiptUriToPersist(cloud, false), null);
    assert.equal(resolveReceiptUriToPersist(cache, false), null);
    assert.equal(resolveReceiptUriToPersist(null, false), null);
  });

  it('keeps only durable URLs once storage is on', () => {
    assert.equal(resolveReceiptUriToPersist(cloud, true), cloud);
    assert.equal(resolveReceiptUriToPersist(cache, true), null);
  });
});
