<?php

/**
 * KnowledgeGraph
 *
 * @licence GPL-2.0-or-later
 * @author thomas-topway-it for KM-A
 */

class KnowledgeGraphApiLoadNodes extends ApiBase {

	/**
	 * @inheritDoc
	 */
	public function isWriteMode() {
		return false;
	}

	/**
	 * @inheritDoc
	 */
	public function mustBePosted(): bool {
		return true;
	}

	/**
	 * @inheritDoc
	 */
	public function execute() {
		$result = $this->getResult();
		$params = $this->extractRequestParams();
		$context = $this->getContext();
		$output = $context->getOutput();

		if ( empty( $params['titles'] ) ) {
			$result->addValue( [ $this->getModuleName() ], 'error', 'empty parameter', ApiResult::NO_VALIDATE );
			return;
		}

		\KnowledgeGraph::initSMW();
		
		$params['only-properties'] = ( !empty( $params['only-properties'] ) ?
			json_decode( $params['only-properties'], true ) : [] );

		$titles = explode( '|', $params['titles'] );
		foreach ( $titles as $titleText ) {
			$title_ = Title::newFromText( $titleText );
			if ( $title_ && $title_->isKnown() ) {
				if ( !isset( self::$data[$title_->getFullText()] ) ) {
					\KnowledgeGraph::setSemanticData( $title_, $params['only-properties'], 0, $params['depth'] );
				}
			}
		}

		$res = json_encode( \KnowledgeGraph::$data );
		$result->addValue( [ $this->getModuleName() ], 'data', $res, ApiResult::NO_VALIDATE );
	}

	/**
	 * @inheritDoc
	 */
	public function getAllowedParams() {
		return [
			'titles' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false
			],
			'only-properties' => [
				ApiBase::PARAM_TYPE => 'string',
				ApiBase::PARAM_REQUIRED => false
			],
			'depth' => [
				ApiBase::PARAM_TYPE => 'integer',
				ApiBase::PARAM_REQUIRED => false
			],
			
		];
	}

	/**
	 * @inheritDoc
	 */
	public function needsToken() {
		return 'csrf';
	}

	/**
	 * @inheritDoc
	 */
	protected function getExamplesMessages() {
		return [
			'action=knowledgegraph-load-nodes'
			=> 'apihelp-knowledgegraph-load-nodes-example-1'
		];
	}

}
